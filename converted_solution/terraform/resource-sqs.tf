resource "aws_sqs_queue" "outbound" {
  name = "chatbot-outbound-queue"
}

resource "aws_sqs_queue" "outbound_dlq" {
  name = "chatbot-outbound-dlq"
}

resource "aws_sqs_queue_policy" "outbound_policy" {
  queue_url = aws_sqs_queue.outbound.id
  policy    = data.aws_iam_policy_document.sqs_policy.json
}

resource "aws_sns_topic_subscription" "messages_to_outbound" {
  topic_arn = aws_sns_topic.messages.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.outbound.arn
}