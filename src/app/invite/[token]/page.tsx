import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InvitationAcceptance } from "@/components/staff/invitation-acceptance";

export const instant = false;

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    notFound();
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invitation = await db.staffInvitation.findUnique({
    where: {
      tokenHash,
    },
    include: {
      organization: {
        select: {
          name: true,
        },
      },
      branches: {
        include: {
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.revokedAt ||
    invitation.expiresAt <= new Date()
  ) {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <InvitationAcceptance
      token={token}
      organizationName={invitation.organization.name}
      invitedEmail={invitation.email}
      role={invitation.role}
      branches={invitation.branches.map((item) => item.branch.name)}
      expiresAt={invitation.expiresAt.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      })}
      isSignedIn={Boolean(session)}
      signedInEmail={session?.user.email ?? null}
    />
  );
}
