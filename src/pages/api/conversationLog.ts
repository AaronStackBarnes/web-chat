import * as pg from "pg";
import { Sequelize, DataTypes, Model, QueryTypes } from "sequelize-cockroachdb";

const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  logging: false,
  dialectModule: pg,
});

class Conversation extends Model {}

Conversation.init(
  {
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entry: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    speaker: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    sequelize,
    modelName: "conversations",
    timestamps: false,
  }
);

sequelize.sync();

type ConversationLogEntry = {
  entry: string;
  created_at: Date;
  speaker: string;
};

class ConversationLog {
  constructor(public userId: string) {
    this.userId = userId;
  }

  public async addEntry({
    entry,
    speaker,
  }: {
    entry: string;
    speaker: string;
  }) {
    try {
      const result = await sequelize.query(
        `SELECT * FROM conversations WHERE user_id = ? AND entry = ? AND speaker = ?`,
        {
          replacements: [this.userId, entry, speaker],
          type: QueryTypes.SELECT,
        }
      );

      if (!result || result.length === 0) {
        // Change this line
        await sequelize.query(
          `INSERT INTO conversations (user_id, entry, speaker, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          {
            replacements: [this.userId, entry, speaker],
          }
        );
      } else {
        await sequelize.query(
          `UPDATE conversations SET entry = ?, speaker = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ? AND entry = ? AND speaker = ?`,
          {
            replacements: [entry, speaker, this.userId, entry, speaker],
          }
        );
      }
    } catch (e) {
      console.log(`Error adding entry: ${e}`);
    }
  }

  public async getConversation({
    limit,
  }: {
    limit: number;
  }): Promise<string[]> {
    const conversation = await sequelize.query(
      `SELECT entry, speaker, created_at FROM conversations WHERE user_id = ? ORDER By created_at DESC LIMIT ?`,
      {
        replacements: [this.userId, limit],
        type: QueryTypes.SELECT,
      }
    );
    const history = conversation as ConversationLogEntry[];

    return history
      .map((entry) => {
        return `${entry.speaker.toUpperCase()}: ${entry.entry}`;
      })
      .reverse();
  }

  public async clearConversation() {
    await sequelize.query(
      `DELETE FROM conversations WHERE user_id = '${this.userId}'`
    );
  }
}

export { ConversationLog };
