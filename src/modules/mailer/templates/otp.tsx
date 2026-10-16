import { Body, Container, Head, Heading, Html, Preview, Section, pixelBasedPreset, Tailwind, Text } from "react-email";
import React from "react";

interface IOTPEmailProps {
  otp: string;
}

export function OTPEmail({ otp }: IOTPEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Preview>Welcome to Language Dangeon</Preview>
        <Body className="bg-white font-sans">
          <Container className="mx-auto py-12">
            <Heading className="text-2xl font-semibold text-black">Welcome</Heading>
            <Text className="text-base text-zinc-700">
              Thanks for signing up in Language Dangeon. Let's get you started.
            </Text>
            <Section className="mt-6">
              <Heading className="text-xl font-semibold text-black">Your one time password</Heading>
              <p>{otp}</p>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
