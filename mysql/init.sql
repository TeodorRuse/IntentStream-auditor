-- Runs automatically when the MySQL container is first created.
-- The database itself is created by MYSQL_DATABASE in docker-compose.yml.

CREATE TABLE IF NOT EXISTS intents (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    record_num       VARCHAR(16)   NOT NULL COMMENT '#NNN sequence from dumpsys',
    broadcast_id     VARCHAR(16)   NULL     COMMENT 'BroadcastRecord hex hash',
    action           VARCHAR(512)  NULL,
    target_component VARCHAR(512)  NULL,
    sender_package   VARCHAR(512)  NULL,
    flags            VARCHAR(32)   NULL     COMMENT 'flg= hex value',
    xflags           VARCHAR(32)   NULL     COMMENT 'xflg= hex value',
    enqueue_time     DATETIME(3)   NULL     COMMENT 'OS enqueue timestamp',
    dispatch_time    DATETIME(3)   NULL,
    finish_time      DATETIME(3)   NULL,
    extras_raw       MEDIUMTEXT    NULL,
    poll_time        DATETIME(3)   NOT NULL COMMENT 'When this row was inserted',
    fingerprint      VARCHAR(128)  NOT NULL COMMENT 'SHA dedup key',
    PRIMARY KEY (id),
    UNIQUE KEY uq_fingerprint (fingerprint),
    INDEX idx_action       (action(128)),
    INDEX idx_sender       (sender_package(128)),
    INDEX idx_enqueue_time (enqueue_time),
    INDEX idx_record_num   (record_num)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Android broadcast intents';

CREATE TABLE IF NOT EXISTS chains (
    id          BIGINT        NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)  NOT NULL,
    description TEXT          NULL,
    created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_chain_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Researcher-defined intent chains';

CREATE TABLE IF NOT EXISTS intents_chains (
    id         BIGINT        NOT NULL AUTO_INCREMENT,
    intent_id  BIGINT        NOT NULL,
    chain_id   BIGINT        NOT NULL,
    position   INT           NOT NULL COMMENT 'Order of this intent within the chain',
    label      VARCHAR(255)  NULL     COMMENT 'Researcher annotation for this step',
    added_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_chain_position (chain_id, position),
    CONSTRAINT fk_ic_intent FOREIGN KEY (intent_id) REFERENCES intents (id) ON DELETE CASCADE,
    CONSTRAINT fk_ic_chain  FOREIGN KEY (chain_id)  REFERENCES chains  (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Intent membership in chains';
