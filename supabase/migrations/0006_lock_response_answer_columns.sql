-- 子どもの回答本体は、登録後に変更されることが基本的にありえないため、
-- 該当列へのUPDATEを明示的に禁止するトリガーを追加する。
-- (SQL Editorでの操作ミス等による事故を未然に防ぐための対策)
--
-- 対象外(ロックしない)列: human_score / human_scorer / human_scored_at /
-- ai_score / ai_confidence / ai_scored_at / final_score / agreement_flag
-- これらは回答提出後に採点(admin-submit-score等)で正当に更新される列のため。

create or replace function responses_prevent_answer_column_update()
returns trigger as $$
begin
  if new.id is distinct from old.id
    or new.subject_id is distinct from old.subject_id
    or new.illustration_id is distinct from old.illustration_id
    or new.verbal_response is distinct from old.verbal_response
    or new.used_choices is distinct from old.used_choices
    or new.presented_choices is distinct from old.presented_choices
    or new.selected_choice_label is distinct from old.selected_choice_label
    or new.recorded_at is distinct from old.recorded_at
  then
    raise exception 'responsesの回答本体列(id/subject_id/illustration_id/verbal_response/used_choices/presented_choices/selected_choice_label/recorded_at)は登録後に変更できません。';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists responses_prevent_answer_column_update_trigger on responses;

create trigger responses_prevent_answer_column_update_trigger
before update on responses
for each row execute function responses_prevent_answer_column_update();
