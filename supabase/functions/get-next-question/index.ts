import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";
import { cumulativeAgeGroups, type AgeGroup } from "../_shared/ageGroup.ts";

const DUMMY_COUNT = 2;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 405);
  }

  const token = extractBearerToken(req);
  if (!token) {
    return jsonResponse({ ok: false, message: MESSAGES.SESSION_EXPIRED }, 401);
  }

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.SESSION_EXPIRED }, 401);
  }

  if (payload.role !== "subject" || typeof payload.sub !== "string") {
    return jsonResponse({ ok: false, message: MESSAGES.SESSION_EXPIRED }, 401);
  }

  const subjectId = payload.sub;

  try {
    const supabase = getSupabaseAdmin();

    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("age_group, child_difficulty_rating")
      .eq("id", subjectId)
      .maybeSingle();
    if (subjectError) throw subjectError;

    if (!subject?.age_group) {
      return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
    }

    const groups = cumulativeAgeGroups(subject.age_group as AgeGroup);

    const { data: illustrations, error: illError } = await supabase
      .from("illustrations")
      .select("id, image_url, correct_label, age_group")
      .in("age_group", groups);
    if (illError) throw illError;

    const { data: answered, error: ansError } = await supabase
      .from("responses")
      .select("illustration_id")
      .eq("subject_id", subjectId);
    if (ansError) throw ansError;

    const allIllustrations = illustrations ?? [];
    const answeredIds = new Set((answered ?? []).map((r) => r.illustration_id));
    const total = allIllustrations.length;
    const unanswered = allIllustrations.filter((i) => !answeredIds.has(i.id));
    const answeredCount = total - unanswered.length;

    if (unanswered.length === 0) {
      return jsonResponse({
        ok: true,
        done: true,
        progress: { answered: answeredCount, total },
        survey_completed: subject.child_difficulty_rating !== null,
      });
    }

    const picked = unanswered[Math.floor(Math.random() * unanswered.length)];

    const sameGroupPool = allIllustrations.filter(
      (i) => i.age_group === picked.age_group && i.id !== picked.id,
    );
    const dummyPool = sameGroupPool.length >= DUMMY_COUNT
      ? sameGroupPool
      : allIllustrations.filter((i) => i.id !== picked.id);
    const dummyCount = Math.min(DUMMY_COUNT, dummyPool.length);
    const dummies = shuffle(dummyPool).slice(0, dummyCount).map((i) => i.correct_label);
    const choices = shuffle([picked.correct_label, ...dummies]);

    return jsonResponse({
      ok: true,
      done: false,
      illustration: { id: picked.id, image_url: picked.image_url },
      choices,
      progress: { answered: answeredCount, total },
    });
  } catch (e) {
    console.error("get-next-question failed:", e);
    await logErrorToDb(`get-next-question failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
