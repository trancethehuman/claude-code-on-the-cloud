import { createUIMessageStreamResponse, createUIMessageStream } from "ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Test chat request:", body);

    // Create a simple test response
    const stream = createUIMessageStream({
      execute({ writer }) {
        writer.write({
          type: 'text',
          value: 'Test response from API - this is working!'
        });

        writer.write({
          type: 'data',
          value: {
            test: true,
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Test chat error:", error);
    return Response.json({ error: "Test failed" }, { status: 500 });
  }
}