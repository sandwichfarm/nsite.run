import { route } from "./router.ts";

declare const Bunny: {
  v1: {
    serve: (
      handler: (req: Request) => Response | Promise<Response>,
    ) => void;
  };
};

Bunny.v1.serve(async (request: Request): Promise<Response> => {
  try {
    return await route(request);
  } catch (err) {
    console.error("Gateway error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
