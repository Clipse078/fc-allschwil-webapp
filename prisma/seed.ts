import { prisma } from "../lib/db/prisma";

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("Seeding demo people...");

  await prisma.person.deleteMany({
    where: {
      OR: [
        { email: { startsWith: "demo.player" } },
        { email: { startsWith: "demo.trainer" } }
      ]
    }
  });

  const birthYears = [2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011];

  for (let i = 1; i <= 25; i++) {
    const year = randomFrom(birthYears);

    await prisma.person.create({
      data: {
        firstName: "Player",
        lastName: "Demo " + i,
        displayName: "Player Demo " + i,
        email: "demo.player" + i + "@fca.ch",
        isPlayer: true,
        isTrainer: false,
        dateOfBirth: new Date(`${year}-06-15`)
      }
    });
  }

  for (let i = 1; i <= 5; i++) {
    await prisma.person.create({
      data: {
        firstName: "Trainer",
        lastName: "Demo " + i,
        displayName: "Trainer Demo " + i,
        email: "demo.trainer" + i + "@fca.ch",
        isPlayer: false,
        isTrainer: true
      }
    });
  }

  console.log("✅ Demo players + trainers created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
