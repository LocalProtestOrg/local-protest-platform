"use client";

import * as React from "react";
import Link from "next/link";

type StateOption = { code: string; name: string };

const STATES: StateOption[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

function ButtonLink({
  href,
  children,
  note,
}: {
  href: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
    >
      <span className="text-center">
        {children}
        {note ? (
          <span className="mt-1 block text-xs font-normal text-neutral-600">
            {note}
          </span>
        ) : null}
      </span>
    </a>
  );
}

function Card({
  title,
  children,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-neutral-900">
        {label}
      </span>
      <textarea
        className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function EmailYourCongresspersonPage() {
  const [state, setState] = React.useState<string>("");
  const [subject, setSubject] = React.useState<string>(
    "Constituent message from a resident of my state"
  );
  const [body, setBody] = React.useState<string>(() => {
    return [
      "Hello,",
      "",
      "I’m a constituent writing from my community. I’m reaching out to share my view on:",
      "",
      "[Briefly describe the issue in 1–2 sentences.]",
      "",
      "What I’m asking for:",
      "- [Action request #1]",
      "- [Action request #2]",
      "",
      "Why it matters locally:",
      "[One short paragraph about how this affects people in your area.]",
      "",
      "Thank you for your time and service.",
      "",
      "Sincerely,",
      "[Your name]",
      "[City, State]",
      "[Optional: phone number]",
    ].join("\n");
  });

  const selectedStateName =
    STATES.find((s) => s.code === state)?.name ?? "";

  const copyToClipboard = async () => {
    const text = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      // Optional: lightweight confirmation without a toast system
      alert("Copied message to clipboard.");
    } catch {
      alert("Could not copy automatically. Please select and copy manually.");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Email Your Congressperson
        </h1>
        <p className="text-sm text-neutral-600">
          Choose your state, then use the official contact tools to reach your
          U.S. Representative and Senators. Many offices use secure contact
          forms (instead of publishing direct email addresses).
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {/* Left column: selector + official tools */}
        <div className="space-y-6 md:col-span-1">
          <Card
            title="1) Select your state"
            subtitle="This helps you follow the right contact flow."
          >
            <label className="block">
              <span className="block text-sm font-medium text-neutral-900">
                State
              </span>
              <select
                className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="">Select a state…</option>
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            {state ? (
              <p className="mt-3 text-xs text-neutral-600">
                Selected: <span className="font-medium">{selectedStateName}</span>
              </p>
            ) : null}
          </Card>

          <Card
            title="2) Official ways to contact Congress"
            subtitle="Most reliable: these tools route you to the correct office contact form."
          >
            <div className="grid gap-3">
              <ButtonLink
                href="https://www.house.gov/representatives/find-your-representative"
                note="Use ZIP code to get your exact Representative + contact page"
              >
                Find Your U.S. Representative
              </ButtonLink>

              <ButtonLink
                href="https://www.senate.gov/senators/senators-contact.htm"
                note="Official senator contact links/forms"
              >
                Contact Your U.S. Senators
              </ButtonLink>

              <ButtonLink
                href="https://www.usa.gov/elected-officials"
                note="USAGov tool for federal contacts"
              >
                USAGov: Find Elected Officials
              </ButtonLink>
            </div>

            <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              <p className="font-medium">Tip</p>
              <p className="mt-1">
                Senate offices often ask you to include a return mailing address
                to confirm you’re a constituent.
              </p>
            </div>
          </Card>

          <Card
            title="Want a faster experience later?"
            subtitle="We can add address lookup to show only *your* Representative (district-based)."
          >
            <p className="text-sm text-neutral-600">
              Today’s page is state-based (simple + safe). The next step is an
              address/ZIP flow that returns your exact delegation.
            </p>
            <div className="mt-4">
              <Link
                href="/"
                className="text-sm font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-700"
              >
                Back to listings
              </Link>
            </div>
          </Card>
        </div>

        {/* Right column: message builder */}
        <div className="space-y-6 md:col-span-2">
          <Card
            title="3) Write your message"
            subtitle="Keep it short, specific, and respectful. One request per message works best."
          >
            <div className="grid gap-4">
              <label className="block">
                <span className="block text-sm font-medium text-neutral-900">
                  Subject line
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject…"
                />
              </label>

              <TextArea
                label="Message"
                value={body}
                onChange={setBody}
                rows={12}
              />

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  Copy message
                </button>

                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    subject
                  )}&body=${encodeURIComponent(body)}`}
                  className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  Open in email app
                </a>
              </div>

              <p className="text-xs text-neutral-500">
                “Open in email app” creates a draft email on your device. If the
                office uses a contact form, paste the message into the form.
              </p>
            </div>
          </Card>

          <Card
            title="Optional: a simple structure that gets read"
            subtitle="This is a proven format for constituent communication."
          >
            <div className="grid gap-3 text-sm text-neutral-700">
              <div className="rounded-md border border-neutral-200 p-4">
                <p className="font-medium text-neutral-900">1) Who you are</p>
                <p className="mt-1">
                  “I live in [City], and I’m a constituent in your district/state.”
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 p-4">
                <p className="font-medium text-neutral-900">2) What you want</p>
                <p className="mt-1">
                  One clear request: “Please support/oppose [X]” or “Please take
                  action to [Y].”
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 p-4">
                <p className="font-medium text-neutral-900">3) Why locally</p>
                <p className="mt-1">
                  A short local impact story (2–4 sentences) is often more
                  persuasive than a long essay.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <footer className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-500">
        <p>
          Local Assembly links to official public contact tools. It does not
          represent Congress and does not send messages on your behalf.
        </p>
      </footer>
    </main>
  );
}
