export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CLIENT_ORIGIN || "*");

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  return res.json({ status: "Thinking..." });
}
