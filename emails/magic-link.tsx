import { Html, Head, Body, Container, Heading, Text, Link, Hr } from "@react-email/components";

interface MagicLinkEmailProps {
  url: string;
}

export default function MagicLinkEmail({
  url = "http://localhost:3000/api/auth/magic-link/verify?token=abc",
}: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f9fafb" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "#fff", padding: "32px" }}>
          <Heading style={{ color: "#1a5632", fontSize: "24px" }}>
            Montgomery County Fish & Game Club
          </Heading>
          <Text>Click the link below to sign in to your member portal:</Text>
          <Link
            href={url}
            style={{
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "#1a5632",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "6px",
            }}
          >
            Sign In
          </Link>
          <Text>This link expires in 10 minutes.</Text>
          <Text style={{ color: "#666", fontSize: "12px" }}>
            If you didn&apos;t request this, you can safely ignore this email.
          </Text>
          <Hr style={{ marginTop: "32px" }} />
          <Text style={{ color: "#666", fontSize: "12px" }}>
            6701 Old Nest Egg Rd, Mt Sterling, KY 40353
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
