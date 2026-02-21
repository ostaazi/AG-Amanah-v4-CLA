export var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["LOW"] = "low";
    AlertSeverity["MEDIUM"] = "med";
    AlertSeverity["HIGH"] = "high";
    AlertSeverity["CRITICAL"] = "critical";
})(AlertSeverity || (AlertSeverity = {}));
export var Classification;
(function (Classification) {
    Classification["NORMAL"] = "normal";
    Classification["RESTRICTED"] = "restricted";
    Classification["LEGAL_HOLD"] = "legal_hold";
})(Classification || (Classification = {}));
export var ContentType;
(function (ContentType) {
    ContentType["TEXT"] = "text";
    ContentType["IMAGE"] = "image";
    ContentType["AUDIO"] = "audio";
    ContentType["VIDEO"] = "video";
})(ContentType || (ContentType = {}));
export var CommandStatus;
(function (CommandStatus) {
    CommandStatus["QUEUED"] = "QUEUED";
    CommandStatus["SENT"] = "SENT";
    CommandStatus["ACKED"] = "ACKED";
    CommandStatus["FAILED"] = "FAILED";
    CommandStatus["EXPIRED"] = "EXPIRED";
})(CommandStatus || (CommandStatus = {}));
export var Category;
(function (Category) {
    Category["BULLYING"] = "\u062A\u0646\u0645\u0631 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A";
    Category["SELF_HARM"] = "\u0625\u064A\u0630\u0627\u0621 \u0627\u0644\u0646\u0641\u0633";
    Category["ADULT_CONTENT"] = "\u0645\u062D\u062A\u0648\u0649 \u0644\u0644\u0628\u0627\u0644\u063A\u064A\u0646";
    Category["PREDATOR"] = "\u062A\u0648\u0627\u0635\u0644 \u0645\u0634\u0628\u0648\u0647";
    Category["VIOLENCE"] = "\u062A\u062D\u0631\u064A\u0636 \u0639\u0644\u0649 \u0627\u0644\u0639\u0646\u0641";
    Category["BLACKMAIL"] = "\u0627\u0628\u062A\u0632\u0627\u0632";
    Category["SEXUAL_EXPLOITATION"] = "\u0627\u0633\u062A\u063A\u0644\u0627\u0644 \u062C\u0646\u0633\u064A";
    Category["PHISHING_LINK"] = "\u0631\u0627\u0628\u0637 \u0645\u0634\u0628\u0648\u0647";
    Category["TAMPER"] = "\u062A\u0644\u0627\u0639\u0628 \u0628\u0627\u0644\u0646\u0638\u0627\u0645";
    Category["GEOFENCE"] = "\u0633\u064A\u0627\u062C \u062C\u063A\u0631\u0627\u0641\u064A";
    Category["SAFE"] = "\u0622\u0645\u0646";
})(Category || (Category = {}));
// Added RiskTrend enum for tracking changes in child risk levels
export var RiskTrend;
(function (RiskTrend) {
    RiskTrend["UP"] = "UP";
    RiskTrend["DOWN"] = "DOWN";
    RiskTrend["STABLE"] = "STABLE";
})(RiskTrend || (RiskTrend = {}));
// Added CommandPriority enum for remote device commands
export var CommandPriority;
(function (CommandPriority) {
    CommandPriority["LOW"] = "low";
    CommandPriority["MEDIUM"] = "med";
    CommandPriority["HIGH"] = "high";
    CommandPriority["CRITICAL"] = "critical";
})(CommandPriority || (CommandPriority = {}));
