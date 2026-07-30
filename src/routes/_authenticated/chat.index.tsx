import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingScreen } from "@/components/common/loading-screen";
import { listConversations, createConversation } from "@/lib/conversations.functions";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({
    meta: [
      { title: "Chat — Nexora AI Workspace" },
      {
        name: "description",
        content: "Stream conversations with your Nexora assistant, backed by long-term memory.",
      },
      { property: "og:title", content: "Chat — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Stream conversations with your Nexora assistant, backed by long-term memory.",
      },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await listConversations()).data,
  });

  useEffect(() => {
    if (!data) return;
    void (async () => {
      const target = data[0]?.id ?? (await createConversation({ data: {} })).data.id;
      void navigate({
        to: "/chat/$conversationId",
        params: { conversationId: target },
        replace: true,
      });
    })();
  }, [data, navigate]);

  return <LoadingScreen label="Opening conversation" />;
}
