import { prisma } from "../lib/db/prisma";

async function main() {
  // prevent duplicates
  await prisma.teamCategoryRule.deleteMany();
  await prisma.clubConfig.deleteMany();

  const config = await prisma.clubConfig.create({
    data: {
      clubName: "FC Allschwil",
      country: "CH",
      teamCategoryRules: {
        create: [
          { category: "G", minTrainerCount: 1, allowedBirthYears: [2018,2019] },
          { category: "F", minTrainerCount: 1, allowedBirthYears: [2017,2018] },
          { category: "E", minTrainerCount: 2, allowedBirthYears: [2015,2016] },
          { category: "D", minTrainerCount: 2, allowedBirthYears: [2013,2014] },
          { category: "C", minTrainerCount: 2, allowedBirthYears: [2011,2012] },
          { category: "B", minTrainerCount: 2, allowedBirthYears: [2009,2010] },
          { category: "A", minTrainerCount: 2, allowedBirthYears: [2007,2008] },
          { category: "AKTIVE", minTrainerCount: 2, allowedBirthYears: [] }
        ]
      }
    }
  });

  console.log("CONFIG CREATED:", config.id);
}

main().finally(() => prisma.$disconnect());



