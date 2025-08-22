resource "aws_lambda_function" "graphql" {
  function_name = "graphql"
  handler       = "index.app"
  runtime       = "python3.11"
  filename      = "build/graphql.zip"
  source_code_hash = filebase64sha256("build/graphql.zip")
  memory_size   = 1024
  timeout       = 900

  environment {
    variables = {}
  }
}

resource "aws_lambda_function" "connect_handler" {
  function_name = "connect_handler"
  handler       = "connect_handler.lambda_handler"
  runtime       = "python3.11"
  filename      = "build/connect_handler.zip"
  source_code_hash = filebase64sha256("build/connect_handler.zip")
  memory_size   = 128
  timeout       = 10

  environment {
    variables = {}
  }
}

resource "aws_lambda_function" "disconnect_handler" {
  function_name = "disconnect_handler"
  handler       = "disconnect_handler.lambda_handler"
  runtime       = "python3.11"
  filename      = "build/disconnect_handler.zip"
  source_code_hash = filebase64sha256("build/disconnect_handler.zip")
  memory_size   = 128
  timeout       = 10

  environment {
    variables = {}
  }
}

resource "aws_lambda_function" "sendmessage_handler" {
  function_name = "sendmessage_handler"
  handler       = "sendmessage_handler.lambda_handler"
  runtime       = "python3.11"
  filename      = "build/sendmessage_handler.zip"
  source_code_hash = filebase64sha256("build/sendmessage_handler.zip")
  memory_size   = 128
  timeout       = 10

  environment {
    variables = {}
  }
}

resource "aws_lambda_function" "subscribe_handler" {
  function_name = "subscribe_handler"
  handler       = "subscribe_handler.lambda_handler"
  runtime       = "python3.11"
  filename      = "build/subscribe_handler.zip"
  source_code_hash = filebase64sha256("build/subscribe_handler.zip")
  memory_size   = 128
  timeout       = 10

  environment {
    variables = {}
  }
}

resource "aws_lambda_function" "notification_handler" {
  function_name = "notification_handler"
  handler       = "notification.lambda_handler"
  runtime       = "python3.11"
  filename      = "build/notification_handler.zip"
  source_code_hash = filebase64sha256("build/notification_handler.zip")
  memory_size   = 256
  timeout       = 30

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.sessions.name
      # Add other env vars as needed
    }
  }

  role = aws_iam_role.lambda_exec.arn
}

resource "aws_lambda_event_source_mapping" "notification_sqs" {
  event_source_arn = aws_sqs_queue.outbound.arn
  function_name    = aws_lambda_function.notification_handler.arn
  batch_size       = 10
  enabled          = true
}

resource "aws_lambda_permission" "apigw_connect" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.connect_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*"
}

resource "aws_lambda_permission" "apigw_disconnect" {
  statement_id  = "AllowExecutionFromAPIGateway_Disconnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.disconnect_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*"
}

resource "aws_lambda_permission" "apigw_sendmessage" {
  statement_id  = "AllowExecutionFromAPIGateway_SendMessage"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sendmessage_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*"
}

resource "aws_lambda_permission" "apigw_subscribe" {
  statement_id  = "AllowExecutionFromAPIGateway_Subscribe"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.subscribe_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*"
}

resource "aws_lambda_permission" "apigw_graphql" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.graphql.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.graphql_api.execution_arn}/*"
}
