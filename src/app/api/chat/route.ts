import OpenAI from "openai";
import { validateMessages } from "@/lib/chat";
import { ChatError, generateReply } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "올바른 JSON 요청을 보내 주세요." }, { status: 400 });
  }
  const result = validateMessages(
    body && typeof body === "object" && "messages" in body ? body.messages : undefined,
  );
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  try {
    const reply = await generateReply(result.messages, request.signal);
    // [확장 포인트] 답변 생성 후 이 위치에 DB 저장·사용량 분석을 연결할 수 있습니다.
    return Response.json({ reply });
  } catch (error) {
    if (error instanceof ChatError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof OpenAI.APIError && error.status === 429) {
      return Response.json({ error: "API 사용 한도에 도달했어요. 잠시 후 다시 시도하거나 사용량을 확인해 주세요." }, { status: 429 });
    }
    // API 키, 공급자의 내부 오류와 스택 정보는 브라우저에 전달하지 않습니다. 원인은 서버 로그에만 남깁니다.
    console.error("chat failed:", error instanceof OpenAI.APIError ? `${error.status} ${error.code} ${error.message}` : error);
    return Response.json({ error: "AI 서버에서 답변을 받지 못했어요. 서버 설정을 확인하거나 잠시 후 다시 보내 주세요." }, { status: 502 });
  }
}
