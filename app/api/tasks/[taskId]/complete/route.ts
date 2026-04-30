import { NextRequest, NextResponse } from "next/server";
import { getCurrentPersonId } from "@/lib/tasks/get-current-person-id";
import { getScopedTaskSourceByTaskIdPrefix } from "@/lib/tasks/scoped-task-registry";

type Context = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_request: NextRequest, context: Context) {
  const { taskId } = await context.params;
  const personId = await getCurrentPersonId();

  if (!personId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = getScopedTaskSourceByTaskIdPrefix(taskId);

  if (!source.completeTask) {
    return NextResponse.json({ error: "Task source does not support completion." }, { status: 400 });
  }

  const result = await source.completeTask(taskId, personId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
