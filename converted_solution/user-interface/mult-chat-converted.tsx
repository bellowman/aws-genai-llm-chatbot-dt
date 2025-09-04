import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  SelectProps,
  SpaceBetween,
  Button,
  Select,
  ColumnLayout,
  Toggle,
  StatusIndicator,
  Container,
  Alert,
} from "@cloudscape-design/components";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import ChatMessage from "./chat-message";
import MultiChatInputPanel, { ChatScrollState } from "./multi-chat-input-panel";
import { ReadyState } from "react-use-websocket";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { Model, Workspace } from "../../API";
import {
  ChatBotConfiguration,
  ChatBotAction,
  ChatBotHistoryItem,
  ChatBotMessageResponse,
  ChatBotMessageType,
  ChatBotRunRequest,
  ChatBotMode,
  ChabotOutputModality,
  ChatBotHeartbeatRequest,
  ChatBotModelInterface,
  FeedbackData,
  ChatBotToken,
} from "./types";
import { LoadingStatus, ModelInterface } from "../../common/types";
import { getSelectedModelMetadata, updateMessageHistoryRef } from "./utils";
import LLMConfigDialog from "./llm-config-dialog";
import styles from "../../styles/chat.module.scss";
import { useNavigate } from "react-router-dom";
import { Utils } from "../../common/utils";

export interface ChatSession {
  configuration: ChatBotConfiguration;
  model?: SelectProps.Option;
  modelMetadata?: Model;
  workspace?: SelectProps.Option;
  id: string;
  loading: boolean;
  running: boolean;
  messageHistory: ChatBotHistoryItem[];
}

const workspaceDefaultOptions: SelectProps.Option[] = [
  {
    label: "No workspace (RAG data source)",
    value: "",
    iconName: "close",
  },
  {
    label: "Create new workspace",
    value: "__create__",
    iconName: "add-plus",
  },
];

export default function MultiChat() {
  const navigate = useNavigate();
  const appContext = useContext(AppContext);
  const ws_endpoint = appContext?.config.websocket_endpoint;
  const refChatSessions = useRef<ChatSession[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [modelsStatus, setModelsStatus] = useState<LoadingStatus>("loading");
  const [workspacesStatus, setWorkspacesStatus] = useState<LoadingStatus>("loading");
  const [enableAddModels, setEnableAddModels] = useState(true);
  const [llmToConfig, setLlmToConfig] = useState<ChatSession | undefined>(undefined);
  const [showMetadata, setShowMetadata] = useState(false);
  const [readyState, setReadyState] = useState<ReadyState>(ReadyState.UNINSTANTIATED);
  const [initError, setInitError] = useState<string | undefined>(undefined);

  // websocket ref
  const ws = useRef<WebSocket | null>(null);

  // Subscriptions: Map sessionId to subscription state
  const sessionSubscriptions = useRef<{ [sessionId: string]: boolean }>({});

  // On mount: connect WebSocket and fetch initial data
  useEffect(() => {
    if (!appContext) return;
    setReadyState(ReadyState.UNINSTANTIATED);

    // Connect WebSocket
    ws.current = new WebSocket(ws_endpoint);

    ws.current.onopen = () => {
      setReadyState(ReadyState.OPEN);
      // Subscribe to all current sessions (if any)
      refChatSessions.current.forEach((session) => {
        subscribeToSession(session.id);
      });
    };

    ws.current.onclose = () => {
      setReadyState(ReadyState.CLOSED);
    };

    ws.current.onerror = (err) => {
      setReadyState(ReadyState.CLOSED);
      setInitError("WebSocket error: " + Utils.getErrorMessage(err));
    };

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!msg.sessionId) return;
        const session = refChatSessions.current.find((c) => c.id === msg.sessionId);
        if (!session) return;

        // For consistency with previous structure, convert incoming to ChatBotMessageResponse
        let response: ChatBotMessageResponse;
        if (typeof msg.message === "string") {
          response = JSON.parse(msg.message);
        } else {
          response = msg.message;
        }
        if (response.action === ChatBotAction.Heartbeat) {
          // Optionally handle heartbeat/ping/pong
          return;
        }

        const messageTokens: { [key: string]: ChatBotToken[] } = {};
        updateMessageHistoryRef(
          session.id,
          session.messageHistory,
          response,
          messageTokens
        );
        if (response.action === ChatBotAction.FinalResponse) {
          session.running = false;
        }
        setChatSessions([...refChatSessions.current]);
      } catch (e) {
        // Ignore badly formatted messages
        console.warn("Invalid message from backend:", event.data, e);
      }
    };

    // Load models and workspaces
    (async () => {
      const apiClient = new ApiClient(appContext);
      let workspaces: Workspace[] = [];
      let modelsResult: any;
      let workspacesResult: any;
      try {
        if (appContext?.config.rag_enabled) {
          [modelsResult, workspacesResult] = await Promise.all([
            apiClient.models.getModels(),
            apiClient.workspaces.getWorkspaces(),
          ]);
          workspaces = workspacesResult.data?.listWorkspaces;
          setWorkspacesStatus(workspacesResult.errors === undefined ? "finished" : "error");
        } else {
          modelsResult = await apiClient.models.getModels();
        }
        const models = modelsResult.data ? modelsResult.data.listModels : [];
        setModels(models);
        setWorkspaces(workspaces);
        setModelsStatus("finished");
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
        setInitError(Utils.getErrorMessage(error));
        setModelsStatus("error");
        setReadyState(ReadyState.CLOSED);
      }
    })();

    // Add two sessions by default
    addSession();
    addSession();
    setEnableAddModels(true);

    // Cleanup
    return () => {
      ws.current?.close();
      refChatSessions.current = [];
      sessionSubscriptions.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appContext]);

  // Helper: subscribe to a chat session via WebSocket
  function subscribeToSession(sessionId: string) {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    if (sessionSubscriptions.current[sessionId]) return; // Already subscribed
    ws.current.send(JSON.stringify({ action: "subscribe", sessionId }));
    sessionSubscriptions.current[sessionId] = true;
  }

  const getChatBotMode = (outputModality: ChabotOutputModality): ChatBotMode => {
    const chatBotModeMap = {
      [ChabotOutputModality.Text]: ChatBotMode.Chain,
      [ChabotOutputModality.Image]: ChatBotMode.ImageGeneration,
      [ChabotOutputModality.Video]: ChatBotMode.VideoGeneration,
    } as { [key: string]: ChatBotMode };

    return chatBotModeMap[outputModality] ?? ChatBotMode.Chain;
  };

  const enabled =
    readyState === ReadyState.OPEN &&
    chatSessions.length > 0 &&
    !chatSessions.some((c) => c.running) &&
    !chatSessions.some((c) => c.loading) &&
    !chatSessions.some((c) => !c.model);

  const handleSendMessage = (message: string): void => {
    if (!enabled) return;
    setEnableAddModels(false);
    chatSessions.forEach((chatSession) => {
      if (chatSession.running) return;
      if (readyState !== ReadyState.OPEN) return;
      ChatScrollState.userHasScrolled = false;

      const { name, provider } = OptionsHelper.parseValue(chatSession.model?.value);
      const outputModalities = (chatSession.modelMetadata?.outputModalities ?? []) as ChabotOutputModality[];
      const value = message.trim();
      const request: ChatBotRunRequest = {
        action: ChatBotAction.Run,
        modelInterface: chatSession.modelMetadata!.interface as ModelInterface,
        data: {
          modelName: name,
          provider: provider,
          sessionId: chatSession.id,
          images: [],
          documents: [],
          videos: [],
          workspaceId: chatSession.workspace?.value,
          modelKwargs: {
            streaming: chatSession.configuration.streaming,
            maxTokens: chatSession.configuration.maxTokens,
            temperature: chatSession.configuration.temperature,
            topP: chatSession.configuration.topP,
            seed: chatSession.configuration.seed,
          },
          text: value,
          mode: getChatBotMode(outputModalities[0] ?? ChabotOutputModality.Text),
        },
      };

      chatSession.running = true;
      chatSession.messageHistory = [
        ...chatSession.messageHistory,
        {
          type: ChatBotMessageType.Human,
          content: value,
          metadata: {},
        },
        {
          type: ChatBotMessageType.AI,
          content: "",
          metadata: {},
        },
      ];

      setChatSessions([...chatSessions]);

      // Send message over WebSocket
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            action: "sendmessage",
            sessionId: chatSession.id,
            message: JSON.stringify(request),
          })
        );
      }
    });
  };

  function addSession() {
    if (refChatSessions.current.length >= 4) return;
    const session = createNewSession();
    refChatSessions.current.push(session);
    setChatSessions([...refChatSessions.current]);
    // If ws is ready, subscribe right away, otherwise will be picked up in onopen
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      subscribeToSession(session.id);
    }
  }

  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }

    const count = Math.max(...chatSessions.map((s) => s.messageHistory.length));

    if (!ChatScrollState.userHasScrolled && count > 0) {
      ChatScrollState.skipNextScrollEvent = true;
      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [chatSessions]);

  const messages = transformMessages(chatSessions);
  const workspaceOptions = [
    ...workspaceDefaultOptions,
    ...OptionsHelper.getSelectOptions(workspaces || []),
  ];

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const handleFeedback = (
    feedbackType: 1 | 0,
    idx: number,
    message: ChatBotHistoryItem,
    messageHistory: ChatBotHistoryItem[]
  ) => {
    if (message.metadata.sessionId) {
      let prompt = "";
      if (
        Array.isArray(message.metadata.prompts) &&
        Array.isArray(message.metadata.prompts[0])
      ) {
        prompt = message.metadata.prompts[0][0];
      }
      const completion = message.content;
      const model = message.metadata.modelId;
      const feedbackData: FeedbackData = {
        sessionId: message.metadata.sessionId as string,
        key: idx,
        feedback: feedbackType,
        prompt: prompt,
        completion: completion,
        model: model as string,
      };
      addUserFeedback(feedbackData);
    }
  };

  const addUserFeedback = async (feedbackData: FeedbackData) => {
    if (!appContext) return;
    const apiClient = new ApiClient(appContext);
    await apiClient.userFeedback.addUserFeedback({ feedbackData });
  };

  return (
    <div className={styles.chat_container}>
      <SpaceBetween size="m">
        {initError && (
          <Alert
            statusIconAriaLabel="Error"
            type="error"
            header="Unable to initialize the Chatbots."
          >
            {initError}
          </Alert>
        )}
        <SpaceBetween size="m" alignItems="end">
          <SpaceBetween size="m" direction="horizontal" alignItems="center">
            <StatusIndicator
              type={
                readyState === ReadyState.OPEN
                  ? "success"
                  : readyState === ReadyState.CONNECTING ||
                    readyState === ReadyState.UNINSTANTIATED
                  ? "in-progress"
                  : "error"
              }
            >
              {readyState === ReadyState.OPEN ? "Connected" : connectionStatus}
            </StatusIndicator>
            <Toggle
              checked={showMetadata ?? false}
              onChange={({ detail }) => setShowMetadata(detail.checked)}
            >
              Show Metadata
            </Toggle>
            <Button
              onClick={() => addSession()}
              disabled={!enableAddModels || chatSessions.length >= 4}
              iconName="add-plus"
              data-locator="add-model"
            >
              Add model
            </Button>
            <Button
              onClick={() => {
                refChatSessions.current.forEach((s) => {
                  // No need to unsubscribe in WS, just clear
                  s.messageHistory = [];
                  s.id = uuidv4();
                  subscribeToSession(s.id);
                });
                setEnableAddModels(true);
                setChatSessions([...refChatSessions.current]);
              }}
              iconName="remove"
            >
              Clear messages
            </Button>
          </SpaceBetween>
        </SpaceBetween>
        <ColumnLayout columns={chatSessions.length}>
          {chatSessions.map((chatSession, index) => (
            <Container key={chatSession.id} data-locator={`model-${index}`}>
              <SpaceBetween direction="vertical" size="m">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr min-content",
                    gap: "8px",
                  }}
                >
                  <Select
                    disabled={!enableAddModels}
                    loadingText="Loading models (might take few seconds)..."
                    statusType={modelsStatus}
                    data-locator={`select-model-${index}`}
                    placeholder="Select a model"
                    empty={
                      <div>
                        No models available. Please make sure you have access to
                        Amazon Bedrock or alternatively deploy a self hosted
                        model on SageMaker or add API_KEY to Secrets Manager
                      </div>
                    }
                    filteringType="auto"
                    selectedOption={chatSession.model ?? null}
                    onChange={({ detail }) => {
                      chatSession.model = detail.selectedOption;
                      chatSession.modelMetadata =
                        getSelectedModelMetadata(
                          models,
                          detail.selectedOption
                        ) ?? undefined;
                      setChatSessions([...chatSessions]);
                    }}
                    options={OptionsHelper.getSelectOptionGroups(models)}
                  />
                  <div style={{ display: "flex", gap: "2px" }}>
                    <Button
                      iconName="settings"
                      variant="icon"
                      onClick={() => setLlmToConfig(chatSession)}
                    />
                    <Button
                      iconName="remove"
                      variant="icon"
                      disabled={chatSessions.length <= 2 || messages.length > 0}
                      onClick={() => {
                        // No need to unsubscribe, just remove
                        refChatSessions.current =
                          refChatSessions.current.filter(
                            (c) => c.id !== chatSession.id
                          );
                        setChatSessions([...refChatSessions.current]);
                      }}
                    />
                  </div>
                </div>
                {llmToConfig && (
                  <LLMConfigDialog
                    session={llmToConfig}
                    setVisible={() => setLlmToConfig(undefined)}
                    onConfigurationChange={(configuration) => {
                      llmToConfig.configuration = configuration;
                      setChatSessions([...chatSessions]);
                    }}
                  />
                )}
                {appContext?.config.rag_enabled && true && (
                  <Select
                    disabled={!enableAddModels}
                    loadingText="Loading workspaces (might take few seconds)..."
                    statusType={workspacesStatus}
                    placeholder="Select a workspace (RAG data source)"
                    filteringType="auto"
                    selectedOption={
                      chatSession.workspace ?? workspaceDefaultOptions[0]
                    }
                    options={workspaceOptions}
                    onChange={({ detail }) => {
                      if (detail.selectedOption?.value === "__create__") {
                        navigate("/rag/workspaces/create");
                      } else {
                        chatSession.workspace = detail.selectedOption;
                        setChatSessions([...chatSessions]);
                      }
                    }}
                    empty={"No Workspaces available"}
                  />
                )}
              </SpaceBetween>
            </Container>
          ))}
        </ColumnLayout>
        {messages.map((val, idx) => {
          if (val.length === 0) {
            return null;
          }

          return (
            <ColumnLayout columns={chatSessions.length} key={idx}>
              {val.map((message, idx) => (
                <ChatMessage
                  key={idx}
                  message={message}
                  showMetadata={showMetadata}
                  onThumbsUp={() => handleFeedback(1, idx, message, val)}
                  onThumbsDown={() => handleFeedback(0, idx, message, val)}
                />
              ))}
            </ColumnLayout>
          );
        })}
      </SpaceBetween>
      <div>
        <MultiChatInputPanel
          running={chatSessions.some((c) => c.running)}
          enabled={enabled}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}

function createNewSession(): ChatSession {
  return {
    id: uuidv4(),
    loading: false,
    running: false,
    messageHistory: [],
    configuration: {
      images: [],
      documents: [],
      videos: [],
      streaming: true,
      showMetadata: false,
      maxTokens: 512,
      temperature: 0.1,
      topP: 0.9,
      seed: 0,
      filesBlob: {
        images: null,
        videos: null,
        documents: null,
      },
    },
  };
}

function transformMessages(sessions: ChatSession[]) {
  const count = Math.max(...sessions.map((s) => s.messageHistory.length));

  const retValue: ChatBotHistoryItem[][] = [];
  for (let i = 0; i < count; i++) {
    const current = [];

    for (const session of sessions) {
      const currentMessage = session.messageHistory[i];
      if (currentMessage) {
        current.push(currentMessage);
      } else {
        current.push({
          type: ChatBotMessageType.AI,
          content: "",
          metadata: {},
        });
      }
    }

    retValue.push(current);
  }

  return retValue;
}