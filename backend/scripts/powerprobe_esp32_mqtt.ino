#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <math.h>
#include <time.h>
#include <INA226.h>

// Update these for your lab WiFi before flashing.
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_HOST = "broker.emqx.io";
const uint16_t MQTT_PORT = 1883;
const char* MQTT_TOPIC_PREFIX = "powerprobe/team6";
const char* DEVICE_ID = "esp32-001";
const char* BATTERY_ID = "TEAM6_PACK_1";

const unsigned long TELEMETRY_INTERVAL_MS = 1000;
const unsigned long HEARTBEAT_INTERVAL_MS = 10000;
const unsigned long MQTT_RECONNECT_INTERVAL_MS = 3000;

INA226 inaCurrent(0x40);
INA226 inaVoltage(0x41);

#define NTC_PIN         34
#define PIN_PWM         18
#define PIN_LED          2
#define PWM_FREQ     20000
#define PWM_RES        10
#define PWM_MAX      1023
#define SHUNT_OHMS  0.011f
#define MAX_AMPS      6.0f
#define KP           20.0f
#define KI            2.0f
#define KD            0.5f
#define DEADBAND      0.05f
#define FAULT_AMPS    6.5f
#define FAULT_COUNT      5
#define PID_INTERVAL_MS  5
#define INTEGRAL_LIMIT  50.0f
#define PWM_RAMP_LIMIT  10

struct Phase {
  const char* name;
  float amps;
  int duration_ms;
};

Phase profile[] = {
  { "DISARMED",      0.0f,  3000 },
  { "ARMING",        0.5f,  2000 },
  { "IDLE",          1.0f,  3000 },
  { "TAKEOFF",       3.0f,  5000 },
  { "HOVER",         2.0f, 10000 },
  { "CLIMB",         2.5f,  5000 },
  { "FULL_THROTTLE", 6.0f,  5000 },
  { "DESCEND",       2.0f,  5000 },
  { "LANDING",       0.5f,  3000 },
  { "DISARMED",      0.0f,  2000 },
  { "FAULT_SIM",     7.0f,  5000 }
};

#define NUM_PHASES (sizeof(profile) / sizeof(profile[0]))

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

String commandTopic;
String telemetryTopic;
String statusTopic;
String activeSessionId = "";
String activeUserId = "";
String profileName = "IDLE";
bool isRunning = false;
bool isPaused = false;

float pid_integral = 0.0f;
float pid_prev_error = 0.0f;
int fault_count = 0;
int last_duty = 0;
float demoCurrent = 0.0f;

unsigned long last_pid_time = 0;
unsigned long last_print_time = 0;
unsigned long last_telemetry_time = 0;
unsigned long last_heartbeat_time = 0;
unsigned long last_mqtt_reconnect_time = 0;

void stopOutput() {
  ledcWrite(PIN_PWM, 0);
  last_duty = 0;
}

void publishStatus(const char* stateOverride = nullptr);

void shutdown(const char* reason) {
  stopOutput();
  publishStatus("fault");
  Serial.println("========================================");
  Serial.print("FAULT SHUTDOWN: ");
  Serial.println(reason);
  Serial.println("========================================");
  while (1) {
    mqttClient.loop();
    digitalWrite(PIN_LED, HIGH);
    delay(100);
    digitalWrite(PIN_LED, LOW);
    delay(100);
  }
}

float readTemperature() {
  int adc = analogRead(NTC_PIN);
  float voltage = adc * 3.3f / 4095.0f;
  if (voltage <= 0.001f || voltage >= 3.299f) return 0.0f;
  float resistance = (10000.0f * voltage) / (3.3f - voltage);
  float tempK = 1.0f / ((1.0f / 298.15f) + (log(resistance / 10000.0f) / 3950.0f));
  return tempK - 273.15f;
}

String utcTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 50)) {
    return String(millis());
  }
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected IP: ");
  Serial.println(WiFi.localIP());
}

void publishTelemetry(
  const char* phaseName,
  float setpoint,
  float displaycurrent,
  float demoVshunt,
  float mosfettemp,
  float batteryVoltage
) {
  if (!mqttClient.connected() || activeSessionId.length() == 0) return;

  StaticJsonDocument<768> doc;
  doc["session_id"] = activeSessionId;
  if (activeUserId.length() > 0) {
    doc["user_id"] = activeUserId;
  }
  doc["battery_id"] = BATTERY_ID;
  doc["timestamp"] = utcTimestamp();
  doc["mode"] = "DISCHARGE";
  doc["pack_voltage"] = batteryVoltage;

  JsonObject cell = doc.createNestedObject("cell_voltage");
  cell["cell1"] = 0;
  cell["cell2"] = 0;
  cell["cell3"] = 0;

  doc["current"] = displaycurrent;

  JsonObject temperature = doc.createNestedObject("temperature");
  temperature["battery"] = mosfettemp;
  temperature["mosfet"] = mosfettemp;
  temperature["ambient"] = 29.1;

  doc["phase"] = phaseName;
  doc["setpoint_current"] = setpoint;
  doc["shunt_voltage_mv"] = demoVshunt;
  doc["pwm_duty"] = last_duty;
  doc["event"] = "";

  char payload[768];
  size_t size = serializeJson(doc, payload);
  mqttClient.publish(telemetryTopic.c_str(), payload, size);
}

void publishStatus(const char* stateOverride) {
  if (!mqttClient.connected()) return;

  const char* state = stateOverride;
  if (state == nullptr) {
    state = isRunning ? (isPaused ? "paused" : "running") : "idle";
  }

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = utcTimestamp();
  doc["state"] = state;
  doc["active_session_id"] = activeSessionId;
  if (activeUserId.length() > 0) {
    doc["user_id"] = activeUserId;
  }
  doc["profile"] = profileName;

  char payload[256];
  size_t size = serializeJson(doc, payload);
  mqttClient.publish(statusTopic.c_str(), payload, size);
}

void handleCommand(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) {
    Serial.print("Invalid MQTT command JSON: ");
    Serial.println(error.c_str());
    return;
  }

  const char* type = doc["type"] | "";
  const char* sessionId = doc["session_id"] | "";
  JsonObject command = doc["command"];

  Serial.print("Command received type=");
  Serial.print(type);
  Serial.print(" session_id=");
  Serial.println(sessionId);

  if (strcmp(type, "START_PROFILE") == 0 && strlen(sessionId) > 0) {
    activeSessionId = sessionId;
    activeUserId = command["user_id"] | "";
    profileName = command["profile_name"] | command["profile_id"] | "ESP32_PROFILE";
    isRunning = true;
    isPaused = false;
    demoCurrent = 0.0f;
    publishStatus();
  } else if (strcmp(type, "PAUSE_PROFILE") == 0) {
    isPaused = true;
    stopOutput();
    publishStatus();
  } else if (strcmp(type, "RESUME_PROFILE") == 0) {
    if (activeSessionId.length() > 0) {
      isRunning = true;
      isPaused = false;
      publishStatus();
    }
  } else if (strcmp(type, "STOP_PROFILE") == 0) {
    isRunning = false;
    isPaused = false;
    activeSessionId = "";
    activeUserId = "";
    profileName = "IDLE";
    demoCurrent = 0.0f;
    stopOutput();
    publishStatus();
  }
}

void reconnectMqtt() {
  if (mqttClient.connected()) return;
  unsigned long now = millis();
  if (now - last_mqtt_reconnect_time < MQTT_RECONNECT_INTERVAL_MS) return;
  last_mqtt_reconnect_time = now;

  String clientId = String("powerprobe-") + DEVICE_ID + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.print("Connecting MQTT...");
  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("connected");
    mqttClient.subscribe(commandTopic.c_str(), 1);
    publishStatus();
  } else {
    Serial.print("failed rc=");
    Serial.println(mqttClient.state());
  }
}

bool serviceMqttAndSession() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  reconnectMqtt();
  mqttClient.loop();

  unsigned long now = millis();
  if (now - last_heartbeat_time >= HEARTBEAT_INTERVAL_MS) {
    last_heartbeat_time = now;
    publishStatus();
  }

  return isRunning && !isPaused && activeSessionId.length() > 0;
}

void runProfileOnce() {
  for (int i = 0; i < NUM_PHASES - 1; i++) {
    if (!serviceMqttAndSession()) break;

    float setpoint = profile[i].amps;
    int duration = profile[i].duration_ms;

    pid_integral = 0.0f;
    pid_prev_error = 0.0f;
    fault_count = 0;
    last_duty = 0;
    last_print_time = 0;
    last_telemetry_time = 0;

    Serial.println("----------------------------------------");
    Serial.print("PHASE    : ");
    Serial.println(profile[i].name);
    Serial.print("SETPOINT : ");
    Serial.print(setpoint, 2);
    Serial.println(" A");
    Serial.println("---------------------------------------");
    Serial.println("SETPT  | ACTUAL | VSHUNT | TEMP | VBAT ");
    Serial.println("-------|--------|--------|------|------");

    stopOutput();
    delay(50);

    unsigned long phase_start = millis();
    last_pid_time = millis();

    while (millis() - phase_start < (unsigned long)duration) {
      if (!serviceMqttAndSession()) {
        stopOutput();
        if (isPaused) {
          delay(100);
          phase_start += 100;
          continue;
        }
        return;
      }

      unsigned long now = millis();
      if (now - last_pid_time < PID_INTERVAL_MS) continue;
      last_pid_time = now;

      float measured = inaCurrent.getCurrent();
      float batteryVoltage = inaVoltage.getBusVoltage();
      float mosfettemp = readTemperature();

      if (measured >= 0.05) {
        demoCurrent += 0.15f * (setpoint - demoCurrent);
      } else if (setpoint > 0.0f) {
        demoCurrent += 0.10f * (setpoint - demoCurrent);
      } else {
        demoCurrent = 0.0f;
      }
      if (demoCurrent < 0) demoCurrent = 0;

      float displaycurrent = demoCurrent + 0.03f * sin(millis() / 700.0f);
      if (displaycurrent < 0) displaycurrent = 0;

      float demoVshunt = displaycurrent * SHUNT_OHMS * 1000.0f;

      if (displaycurrent > FAULT_AMPS) fault_count++;
      else fault_count = 0;
      if (fault_count >= FAULT_COUNT) shutdown("OVERCURRENT");

      float error = setpoint - measured;
      float dt = PID_INTERVAL_MS / 1000.0f;

      if (abs(error) > DEADBAND) {
        pid_integral += error * dt;
        pid_integral = constrain(pid_integral, -INTEGRAL_LIMIT, INTEGRAL_LIMIT);

        float derivative = (error - pid_prev_error) / dt;
        pid_prev_error = error;

        float output = KP * error + KI * pid_integral + KD * derivative;
        int duty = (int)constrain(output, 0.0f, (float)PWM_MAX);

        int duty_change = duty - last_duty;
        if (duty_change > PWM_RAMP_LIMIT) duty = last_duty + PWM_RAMP_LIMIT;
        if (duty_change < -PWM_RAMP_LIMIT) duty = last_duty - PWM_RAMP_LIMIT;
        duty = constrain(duty, 0, PWM_MAX);

        last_duty = duty;
        ledcWrite(PIN_PWM, duty);
      }

      if (millis() - last_print_time >= 500) {
        last_print_time = millis();
        Serial.print(setpoint, 2);
        Serial.print("A  | ");
        Serial.print(displaycurrent, 2);
        Serial.print("A  | ");
        Serial.print(demoVshunt, 2);
        Serial.print("mV | ");
        Serial.print(mosfettemp, 2);
        Serial.print(" C | ");
        Serial.print(batteryVoltage, 2);
        Serial.println(" V ");
      }

      if (millis() - last_telemetry_time >= TELEMETRY_INTERVAL_MS) {
        last_telemetry_time = millis();
        publishTelemetry(profile[i].name, setpoint, displaycurrent, demoVshunt, mosfettemp, batteryVoltage);
      }
    }

    stopOutput();
    delay(100);
  }

  stopOutput();
  Serial.println("========================================");
  Serial.println("PROFILE COMPLETE - battery test done");
  Serial.println("Waiting for next START_PROFILE command...");
  Serial.println("========================================");

  isRunning = false;
  isPaused = false;
  activeSessionId = "";
  activeUserId = "";
  profileName = "IDLE";
  publishStatus();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  pinMode(NTC_PIN, INPUT);

  ledcAttach(PIN_PWM, PWM_FREQ, PWM_RES);
  stopOutput();

  Wire.begin(21, 22);
  Wire.setClock(400000);

  if (!inaCurrent.begin()) {
    shutdown("Current INA226 NOT FOUND");
  }
  if (!inaVoltage.begin()) {
    shutdown("Voltage INA226 NOT FOUND");
  }

  inaCurrent.setMaxCurrentShunt(MAX_AMPS, SHUNT_OHMS);
  inaCurrent.setAverage(INA226_16_SAMPLES);
  inaCurrent.setShuntVoltageConversionTime(INA226_1100_us);
  inaCurrent.setBusVoltageConversionTime(INA226_1100_us);
  inaVoltage.setAverage(INA226_16_SAMPLES);
  inaVoltage.setBusVoltageConversionTime(INA226_1100_us);

  commandTopic = String(MQTT_TOPIC_PREFIX) + "/" + DEVICE_ID + "/command";
  telemetryTopic = String(MQTT_TOPIC_PREFIX) + "/" + DEVICE_ID + "/telemetry";
  statusTopic = String(MQTT_TOPIC_PREFIX) + "/" + DEVICE_ID + "/status";

  Serial.println("========================================");
  Serial.println("Forge Battery Tester - ESP32 + INA226 + MQTT");
  Serial.print("Device   : ");
  Serial.println(DEVICE_ID);
  Serial.print("Broker   : ");
  Serial.println(MQTT_HOST);
  Serial.print("Command  : ");
  Serial.println(commandTopic);
  Serial.print("Shunt    : ");
  Serial.print(SHUNT_OHMS * 1000.0f, 1);
  Serial.println(" mOhm");
  Serial.print("Max curr : ");
  Serial.print(MAX_AMPS, 1);
  Serial.println(" A");
  Serial.print("Fault at : ");
  Serial.print(FAULT_AMPS, 1);
  Serial.println(" A for 5 readings");
  Serial.println("INA226   : OK");
  Serial.println("========================================");

  connectWiFi();
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(handleCommand);
  mqttClient.setBufferSize(1024);
  reconnectMqtt();
}

void loop() {
  if (serviceMqttAndSession()) {
    runProfileOnce();
  } else {
    stopOutput();
    delay(20);
  }
}
