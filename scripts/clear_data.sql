TRUNCATE TABLE
    approval_actions,
    approval_stage_definitions,
    blockchain_events,
    document_events,
    verification_logs,
    student_grades,
    student_progress,
    digital_objects,
    universities,
    users
RESTART IDENTITY CASCADE;
