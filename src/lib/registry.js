import VideoTemplate from "@/components/templates/VideoTemplate";
import { DEFAULT_MODEL_ID } from "./models";

// Every scenario on /studio renders through the video template; the config decides the rest.
export const templateRegistry = {
  "ai-video": {
    id: "ai-video",
    name: "H3 Max Video",
    description: "A focused MiniMax H3 Max video tool: fixed model and settings, a minimal form for the user.",
    component: VideoTemplate,
    defaultConfig: {
      modelEndpoint: DEFAULT_MODEL_ID,
      systemPrompt: "",
      duration: 5,
      resolution: "768P",
      aspectRatio: "",
      creditCost: 60,
      theme: "slate-indigo",
      showPrompt: true,
      userParams: [],
    },
  },
};

export const getTemplate = (id) => templateRegistry[id] || null;
export const getAllTemplates = () => Object.values(templateRegistry);
