# plans/ — 実装計画ファイル一覧

実装計画ファイルのインデックス。仕様の単一情報源は **`docs/spec.md` v4.0** (2026-05-15 リセット)。

各 plan は `/blueprint` 産で、Opus 対敵レビュー済み。実装は `/implement plans/<file>.md` で順次実行する。

---

## 🚀 次に実装すべき plan

| ファイル                                 | 内容                                                                    | 状態    |
| ---------------------------------------- | ----------------------------------------------------------------------- | ------- |
| **[spec-v4-reset.md](spec-v4-reset.md)** | spec v3.3 → v4.0 リセット。9 ステップ、Opus 対敵レビュー反映 (C4/M6/m7) | 🚀 NEXT |

**実行戦略:** Batch A〜F の段階実行(A: S1+S2 / B: S3 / C: S4+S5 / D: S6 / E: S7 / F: S8+S9)。`/implement` の一括実行は手動検証ステップ skip と Open Questions の独断確定リスクのため非推奨。

---

## 完了済み・廃案予定の plan

`docs/spec.md` v4.0 のリセット(M-01〜M-04 の累積仕様修正を破棄)により、v3.x 時代の plan は **完了済みかつ v4.0 で実装が削除される** ケースが多い。実装の参考にする際は v4.0 spec との整合を必ず確認すること。

| ファイル                                                                                         | ステータス                                                                 |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [phase1-auth-views-input.md](phase1-auth-views-input.md)                                         | ✅ 完了(認証 + V1 + I1 まで実装済み、A1〜A5 は v4.0 で残る)                |
| [phase2-timeline-task-detail.md](phase2-timeline-task-detail.md)                                 | ⚠️ 廃案(V2/V3 は v4.0 で廃止、`spec-v4-reset` S3 で撤去)                   |
| [phase3-dashboard.md](phase3-dashboard.md)                                                       | ⚠️ 廃案(V4 予兆検知ダッシュボードは v4.0 で廃止)                           |
| [fix-all-tests.md](fix-all-tests.md)                                                             | ✅ 完了(Vitest + E2E green 化、その後の M-03/M-04 で再度膨らんだ)          |
| [test-implementation.md](test-implementation.md)                                                 | ✅ 完了(テスト仕様書 v1.1 実装)                                            |
| [spec-amendments-m01-m02.md](spec-amendments-m01-m02.md)                                         | ✅ 完了 → ⚠️ v4.0 で破棄(重み均等割り / TodoTemplate の重み再配分は廃止)   |
| [today-line-and-bar-overdue-semantics.md](today-line-and-bar-overdue-semantics.md)               | ✅ 完了 → ⚠️ v4.0 で破棄(今日線 3 役 / バー overdue 赤塗りは廃止)          |
| [dual-checkbox-and-bar-overrun-visualization.md](dual-checkbox-and-bar-overrun-visualization.md) | ✅ 完了(M-03)→ ⚠️ v4.0 で破棄(dual checkbox / バー 5 状態 / DB CHECK 制約) |

---

## 凡例

- 🚀 **NEXT** = 現在実装すべき plan
- ✅ **完了** = 実装が main にマージ済み
- ⚠️ **廃案 / 破棄** = v4.0 リセットで該当機能・実装が削除される

---

## 補足

- 各 plan ファイル冒頭の `**Status:**` ヘッダも参照(Reviewed / Draft / Pending 等)
- v4.0 で残るのは Phase 0(ローカル開発環境)+ Phase 1 の **認証 / 招待 / プロジェクト・メンバー管理(A1〜A5)** のみ。それ以外の業務系画面(V1 ツリービュー / V2 / V3 / V4 / I1 日報入力)は v4.0 G1/G2/G3 に集約・置換される
- v4.0 リセットの再開ポイントは `~/.claude/projects/C--develop-foresight/memory/project_spec_v4_reset.md` を参照
