const mongoose = require("mongoose");
const PrintJob = require("../models/print-job-schema");

// INFO: Not running this migration currently will check with initial changes first.
async function updateExpiryForOlderJobs() {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const allJobs = await PrintJob.find({});

    const pastDate = new Date("2020-01-01T00:00:00.000Z");

    for (const job of allJobs) {
      job.confirmation_code_expiry = pastDate;
      await job.save();
    }

    console.log(
      `Updated ${allJobs.length} print jobs with a past expiry date.`,
    );
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

updateExpiryForOlderJobs();
