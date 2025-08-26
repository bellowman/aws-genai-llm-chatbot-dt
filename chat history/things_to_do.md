# Things to Do
## `schema.graphql`
- add new datetime type

## `api-handler/apollo.py`
    - handle new datetime type
    - add resolver for sendQuery, publishResponse

## `subscribe.py`
- refactor

## `outbound.py`
- add


# Things to check
##  `appsync-ws.ts`
- Resolvers
    - All logic in JS/Python resolvers in AppSync (e.g. sendQuery, publishResponse, receiveMessages) must be re-implemented as Python code in your Lambda handlers/Apollo resolvers/WebSocket handlers.
- SQS-triggered Outbound
    - Outbound message Lambda (triggered by SQS) must now know how to send to the correct WebSocket connection (via API Gateway Management API).