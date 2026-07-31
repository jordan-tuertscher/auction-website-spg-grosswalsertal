import { handleUpload } from "@vercel/blob/client";

export default async function handler(req, res) {
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let password = null;
        try {
          password = clientPayload ? JSON.parse(clientPayload).password : null;
        } catch (e) {
          password = null;
        }
        if (password !== process.env.ADMIN_PASSWORD) {
          throw new Error("Nicht autorisiert.");
        }
        return {
          allowedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // no-op
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
