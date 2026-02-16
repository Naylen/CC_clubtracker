import { Html, Head, Body, Container, Heading, Hr, Text } from "@react-email/components";

interface BroadcastEmailProps {
  body: string;
}

export default function BroadcastEmail({
  body = "<p>This is a broadcast message from MCFGC.</p>",
}: BroadcastEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f9fafb" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "#fff", padding: "32px" }}>
          <Heading style={{ color: "#1a5632", fontSize: "24px" }}>
            Montgomery County Fish & Game Club
          </Heading>
          <div dangerouslySetInnerHTML={{ __html: body }} />
          <Hr style={{ marginTop: "32px" }} />
          <Text style={{ color: "#666", fontSize: "12px" }}>
            6701 Old Nest Egg Rd, Mt Sterling, KY 40353
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
