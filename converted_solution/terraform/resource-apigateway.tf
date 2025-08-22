#################################
# WebSocket API for Chat
#################################
resource "aws_apigatewayv2_api" "websocket_api" {
  name                       = "chat-websocket-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

# connect
resource "aws_apigatewayv2_integration" "connect_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.connect_handler.invoke_arn
}

resource "aws_apigatewayv2_route" "connect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connect_integration.id}"
}

# disconnect
resource "aws_apigatewayv2_integration" "disconnect_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.disconnect_handler.invoke_arn
}

resource "aws_apigatewayv2_route" "disconnect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.disconnect_integration.id}"
}

# sendMessage
resource "aws_apigatewayv2_integration" "sendmessage_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.sendmessage_handler.invoke_arn
}

resource "aws_apigatewayv2_route" "sendmessage_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$sendmessage"
  target    = "integrations/${aws_apigatewayv2_integration.sendmessage_integration.id}"
}

# subscribe
resource "aws_apigatewayv2_integration" "subscribe_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.subscribe_handler.invoke_arn
}

resource "aws_apigatewayv2_route" "subscribe_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$subscribe"
  target    = "integrations/${aws_apigatewayv2_integration.subscribe_integration.id}"
}

resource "aws_apigatewayv2_deployment" "websocket_deployment" {
  api_id = aws_apigatewayv2_api.websocket_api.id
  depends_on = [
    aws_apigatewayv2_route.connect_route,
    aws_apigatewayv2_route.disconnect_route,
    aws_apigatewayv2_route.sendmessage_route,
    aws_apigatewayv2_route.subscribe_route
  ]
}

resource "aws_apigatewayv2_stage" "websocket_stage" {
  api_id        = aws_apigatewayv2_api.websocket_api.id
  name          = "dev"
  deployment_id = aws_apigatewayv2_deployment.websocket_deployment.id
}

#################################
# Apollo Server (GraphQL) via HTTP API
#################################
resource "aws_apigatewayv2_api" "graphql_api" {
  name          = "graphql-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "graphql_lambda" {
  api_id           = aws_apigatewayv2_api.graphql_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.graphql.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "graphql_post" {
  api_id    = aws_apigatewayv2_api.graphql_api.id
  route_key = "POST /graphql"
  target    = "integrations/${aws_apigatewayv2_integration.graphql_lambda.id}"
}

resource "aws_apigatewayv2_deployment" "graphql_deployment" {
  api_id = aws_apigatewayv2_api.graphql_api.id
  depends_on = [
    aws_apigatewayv2_route.graphql_post
  ]
}

resource "aws_apigatewayv2_stage" "graphql_stage" {
  api_id        = aws_apigatewayv2_api.graphql_api.id
  name          = "dev"
  deployment_id = aws_apigatewayv2_deployment.graphql_deployment.id
}
