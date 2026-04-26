import { prisma } from "../lib/db/prisma";

async function main() {
  const trainerDiplomas = [
    { email: "demo.trainer1@fca.ch", title: "SFV C-Diplom", issuer: "SFV", status: "VALID" },
    { email: "demo.trainer2@fca.ch", title: "Kinderfussball-Diplom", issuer: "FVNWS", status: "VALID" },
    { email: "demo.trainer3@fca.ch", title: "SFV D-Diplom", issuer: "SFV", status: "VALID" },
    { email: "demo.trainer4@fca.ch", title: "J+S Leiter Fussball", issuer: "J+S", status: "VALID" },
    { email: "demo.trainer5@fca.ch", title: "Erste Hilfe Kurs", issuer: "Samariter Schweiz", status: "VALID" },
  ] as const;

  for (const item of trainerDiplomas) {
    const person = await prisma.person.findFirst({ where: { email: item.email } });
    if (!person) continue;

    await prisma.trainerQualification.deleteMany({ where: { personId: person.id } });

    await prisma.trainerQualification.create({
      data: {
        personId: person.id,
        title: item.title,
        issuer: item.issuer,
        status: item.status,
        type: item.title.includes("Erste Hilfe") ? "FIRST_AID" : "DIPLOMA",
        isClubVerified: true,
        isWebsiteVisible: true,
      },
    });
  }

  console.log("✅ Demo trainer qualifications seeded");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
