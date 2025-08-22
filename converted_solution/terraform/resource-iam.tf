# grant permission to call API Gateway endpoints for Lambdas
resource "aws_iam_policy" "manage_connections" {
  name        = "ManageConnectionsPolicy"
  description = "Allow Lambda to manage WebSocket connections"
  policy      = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "execute-api:ManageConnections"
        Resource = "arn:aws:execute-api:${var.region}:${var.account_id}:${aws_apigatewayv2_api.websocket_api.id}/*"
      }
    ]
  })
}

resource "aws_iam_role" "lambda_exec" {
  name = "chatbot-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Add additional policies for DynamoDB, S3, SNS, SQS, etc.