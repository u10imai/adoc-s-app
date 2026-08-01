import { formatJst } from "./datetime.ts";
import { toCsv } from "./csv.ts";
import { corsHeaders } from "./cors.ts";
import { getSupabaseAdmin } from "./supabaseAdmin.ts";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

export const SUBJECT_COLUMNS = [
  "subject_code", "subject_type", "examiner_type", "guardian_profession", "guardian_profession_other",
  "exam_date", "birth_date", "gender", "age_months", "grade", "age_group",
  "has_diagnosis", "diagnosis_status", "diagnosis_note", "basic_info_completed",
  "child_difficulty_rating", "caregiver_comprehension_rating", "created_at",
];

export const RESPONSE_COLUMNS = [
  "subject_code", "illustration_correct_label", "illustration_age_group",
  "verbal_response", "used_choices", "presented_choices", "selected_choice_label",
  "recorded_at", "human_score", "human_scorer", "human_scored_at",
  "ai_score", "ai_confidence", "ai_scored_at", "final_score", "agreement_flag",
];

function first<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export async function fetchSubjectsCsv(supabase: SupabaseAdminClient): Promise<string> {
  const { data, error } = await supabase
    .from("subjects")
    .select(`
      subject_code, subject_type, examiner_type, guardian_profession, guardian_profession_other,
      exam_date, birth_date, gender, age_months, grade, age_group,
      has_diagnosis, diagnosis_status, diagnosis_note, basic_info_completed,
      child_difficulty_rating, caregiver_comprehension_rating, created_at
    `)
    .order("subject_code", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []).map((r) => ({ ...r, created_at: formatJst(r.created_at) }));
  return toCsv(rows, SUBJECT_COLUMNS);
}

export async function fetchResponsesCsv(supabase: SupabaseAdminClient): Promise<string> {
  const { data, error } = await supabase
    .from("responses")
    .select(`
      verbal_response, used_choices, presented_choices, selected_choice_label, recorded_at,
      human_score, human_scorer, human_scored_at,
      ai_score, ai_confidence, ai_scored_at, final_score, agreement_flag,
      subjects ( subject_code ),
      illustrations ( correct_label, age_group )
    `)
    .order("recorded_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []).map((r) => {
    const subject = first(r.subjects as unknown);
    const illustration = first(r.illustrations as unknown);
    return {
      subject_code: (subject as { subject_code?: string } | null)?.subject_code ?? null,
      illustration_correct_label: (illustration as { correct_label?: string } | null)?.correct_label ?? null,
      illustration_age_group: (illustration as { age_group?: string } | null)?.age_group ?? null,
      verbal_response: r.verbal_response,
      used_choices: r.used_choices,
      presented_choices: r.presented_choices ? JSON.stringify(r.presented_choices) : null,
      selected_choice_label: r.selected_choice_label,
      recorded_at: formatJst(r.recorded_at),
      human_score: r.human_score,
      human_scorer: r.human_scorer,
      human_scored_at: formatJst(r.human_scored_at),
      ai_score: r.ai_score,
      ai_confidence: r.ai_confidence,
      ai_scored_at: formatJst(r.ai_scored_at),
      final_score: r.final_score,
      agreement_flag: r.agreement_flag,
    };
  });

  return toCsv(rows, RESPONSE_COLUMNS);
}

export function csvResponse(table: string, csvText: string): Response {
  const today = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csvText, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${table}_${today}.csv"`,
    },
  });
}
