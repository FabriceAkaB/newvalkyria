import { NextResponse } from "next/server";

import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getParentAccount } from "@/lib/parent-repo";

export async function GET() {
  const userId = await getParentUserId();
  if (!userId) return NextResponse.json({ loggedIn: false });

  const [account, children] = await Promise.all([getParentAccount(userId), getChildrenForParent(userId)]);

  return NextResponse.json({
    loggedIn: true,
    email: account?.email ?? "",
    fullName: account?.fullName ?? "",
    children
  });
}
