export const TRANSLATION_SCHEMA = {
  name: "translation_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "Line ID, must match the input id exactly",
            },
            original: {
              type: "string",
              description:
                "Original text, must be copied from the input exactly as-is",
            },
            translated: {
              type: "string",
              description: "Translated subtitle text",
            },
          },
          required: ["id", "original", "translated"],
          additionalProperties: false,
        },
      },
    },
    required: ["translations"],
    additionalProperties: false,
  },
};
