import { Html, Head, Body, Container, Heading, Text, Link, Hr } from "@react-email/components";

interface RenewalReminderProps {
  householdName: string;
  year: number;
  portalUrl: string;
}

export default function RenewalReminder({
  householdName = "Smith Family",
  year = 2027,
  portalUrl = "http://localhost:3000/member/renew",
}: RenewalReminderProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f9fafb" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "#fff", padding: "32px" }}>
          <Heading style={{ color: "#1a5632", fontSize: "24px" }}>
            Montgomery County Fish & Game Club
          </Heading>
          <Text>Hello {householdName},</Text>
          <Text>
            It&apos;s time to renew your MCFGC membership for {year}.
          </Text>
          <Text>
            Payment must be received by <strong>January 31, {year}</strong> to
            maintain your membership. After that date, your slot becomes
            available to new applicants.
          </Text>
          <Link
            href={portalUrl}
            style={{
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "#1a5632",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "6px",
            }}
          >
            Renew Now
          </Link>
          <Hr style={{ marginTop: "32px" }} />
          <Text style={{ color: "#666", fontSize: "12px" }}>
            6701 Old Nest Egg Rd, Mt Sterling, KY 40353
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
