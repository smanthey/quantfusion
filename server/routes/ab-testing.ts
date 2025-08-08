import { Router } from 'express';
import { abTesting } from '../services/ab-testing';

const router = Router();

// Get all active A/B tests
router.get('/tests', (req, res) => {
  try {
    const activeTests = abTesting.getActiveTests();
    res.json({ tests: activeTests });
  } catch (error) {
    console.error('Error fetching A/B tests:', error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
});

// Get A/B test results
router.get('/results', (req, res) => {
  try {
    const results = abTesting.getTestResults();
    res.json({ results });
  } catch (error) {
    console.error('Error fetching A/B test results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get comprehensive A/B test report
router.get('/report', (req, res) => {
  try {
    const report = abTesting.generateTestReport();
    res.json({ report, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error generating A/B test report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Pause a specific test
router.post('/tests/:testId/pause', (req, res) => {
  try {
    const { testId } = req.params;
    abTesting.pauseTest(testId);
    res.json({ success: true, message: `Test ${testId} paused` });
  } catch (error) {
    console.error('Error pausing test:', error);
    res.status(500).json({ error: 'Failed to pause test' });
  }
});

// Resume a specific test
router.post('/tests/:testId/resume', (req, res) => {
  try {
    const { testId } = req.params;
    abTesting.resumeTest(testId);
    res.json({ success: true, message: `Test ${testId} resumed` });
  } catch (error) {
    console.error('Error resuming test:', error);
    res.status(500).json({ error: 'Failed to resume test' });
  }
});

export { router as abTestingRouter };