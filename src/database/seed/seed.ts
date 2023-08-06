import { dotenvConfig } from "../../configs/vars.config";
import inquirer from "inquirer";
import logger from "../../configs/logger.config";
import prisma from "../../configs/prisma.config";
import { seedInitUsers } from "./user.seed";
import { seedInitCustomerLevels } from "./customerlvl.seed";
import { seedGeneratedCustomer } from "./customer.seed";
import { seedInitServices } from "./service.seed";
import { seedInitSettings } from "./setting.seed";

dotenvConfig;

type SeedType = "initial" | "generate";
type SeedChoicesType = { name: string; value: SeedType };

const prompt = inquirer.createPromptModule();

(async () => {
  console.log("");
  logger.info("[SEED] Start seeding...");

  try {
    console.log("");
    const seedTypePrompt = (await prompt([
      {
        type: "list",
        name: "seedType",
        message: `Select seed type`,
        choices: <SeedChoicesType[]>[
          { name: "Initial", value: "initial" },
          { name: "Generate", value: "generate" },
        ],
      },
      {
        type: "input",
        name: "resultNumber",
        message: `Input the total number of data to be generated :`,
        when(answers) {
          return answers.seedType === "generate";
        },
      },
    ])) as { seedType: SeedType; resultNumber: string };

    if (seedTypePrompt.seedType == "initial") {
      logger.info("[SEED] Initial seed...");

      await prisma.$transaction(async trx => {
        return await Promise.all([
          seedInitUsers(trx),
          seedInitCustomerLevels(trx),
          seedInitServices(trx),
          seedInitSettings(trx),
        ]);
      });

      logger.info("[SEED] Initial successfully ");
    }

    if (seedTypePrompt.seedType === "generate") {
      logger.info("[SEED] Generate seed...");

      await prisma.$transaction(async trx => {
        return await Promise.all([
          seedGeneratedCustomer({
            numResult: +seedTypePrompt.resultNumber,
            prismaTx: trx,
          }),
        ]);
      });
      logger.info("[SEED] Generate seed successfully ");
    }

    logger.info("[SEED] Database seeded successfully!");
  } catch (error) {
    logger.info("[SEED] Database seeded failed!");
    console.log(error);
  } finally {
    await prisma.$disconnect();
  }
})();

// main()
//   .catch((err: any) => {
//     console.error(err);
//   })
//   .finally(async () => {
//   });
