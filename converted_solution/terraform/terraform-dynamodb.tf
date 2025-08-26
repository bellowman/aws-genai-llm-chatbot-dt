resource "aws_dynamodb_table" "sessions" {
  name           = "chatbot-sessions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "connectionId"
  attribute {
    name = "connectionId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  global_secondary_index {
    name            = "byUserIdIndex"
    hash_key        = "userId"
    projection_type = "ALL"
  }
  # Add additional attributes and GSIs as needed
}

resource "aws_dynamodb_table" "application" {
  name           = "chatbot-application"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "applicationId"
  attribute {
    name = "applicationId"
    type = "S"
  }
}