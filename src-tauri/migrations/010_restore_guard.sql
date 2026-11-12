CREATE TABLE local_restore_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1),hold INTEGER NOT NULL DEFAULT 0 CHECK(hold IN(0,1)),recovery_name TEXT);
INSERT INTO local_restore_state(singleton) VALUES(1);
