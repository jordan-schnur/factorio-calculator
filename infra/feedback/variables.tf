variable "reserved_concurrency" {
  description = "Reserved concurrent executions for the feedback Lambda; set to null to skip reservation."
  type        = number
  default     = 2
  nullable    = true
}
