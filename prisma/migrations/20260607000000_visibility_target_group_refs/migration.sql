-- Phase D — TargetGroup Visibility Integration
-- Additive only: no destructive changes, no data loss, zero downtime safe.
--
-- Adds visibleTargetGroupRefs (JSONB) to Meeting, Initiative, and Target.
-- These refs contain target group IDs whose resolved members are granted visibility.
-- Evaluation is done at application layer via canSeeEntity() + ActorContext.targetGroupIds.

-- Meeting
ALTER TABLE "Meeting" ADD COLUMN "visibleTargetGroupRefs" JSONB;

-- Initiative
ALTER TABLE "Initiative" ADD COLUMN "visibleTargetGroupRefs" JSONB;

-- Target
ALTER TABLE "Target" ADD COLUMN "visibleTargetGroupRefs" JSONB;
