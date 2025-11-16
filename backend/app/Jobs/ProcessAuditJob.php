<?php

namespace App\Jobs;

use App\Events\AuditUpdated;
use App\Models\Audit;
use Barryvdh\Snappy\Facades\SnappyPdf;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessAuditJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public Audit $audit
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Update status to processing
            $this->audit->update(['status' => 'processing']);
            broadcast(new AuditUpdated($this->audit))->toOthers();

            // Call Lighthouse service
            $lighthouseUrl = config('services.lighthouse.url', 'http://localhost:3000/api/lighthouse');

            $response = Http::timeout(300)->post($lighthouseUrl, [
                'url' => $this->audit->domain,
            ]);

            if (!$response->successful()) {
                throw new \Exception('Lighthouse service failed: ' . $response->body());
            }

            $lighthouseResult = $response->json();

            // Extract scores from Lighthouse result
            $scores = [
                'accessibility' => ['score' => $lighthouseResult['categories']['accessibility']['score'] ?? 0],
                'best_practices' => ['score' => $lighthouseResult['categories']['best-practices']['score'] ?? 0],
                'performance' => ['score' => $lighthouseResult['categories']['performance']['score'] ?? 0],
                'seo' => ['score' => $lighthouseResult['categories']['seo']['score'] ?? 0],
            ];

            // Update audit with Lighthouse results
            $this->audit->update([
                'lighthouse_result' => $scores,
            ]);

            // Generate PDF from results
            $pdfPath = $this->generatePDF($scores);

            // Update audit with PDF path and mark as completed
            $this->audit->update([
                'pdf_path' => $pdfPath,
                'status' => 'completed',
            ]);

            // Broadcast completion event
            broadcast(new AuditUpdated($this->audit))->toOthers();
        } catch (\Exception $e) {
            Log::error('Audit processing failed: ' . $e->getMessage(), [
                'audit_id' => $this->audit->id,
                'error' => $e->getMessage(),
            ]);

            $this->audit->update(['status' => 'failed']);
            broadcast(new AuditUpdated($this->audit))->toOthers();

            throw $e;
        }
    }

    /**
     * Generate PDF report from audit results.
     */
    private function generatePDF(array $scores): string
    {
        $html = view('pdf.audit-report', [
            'audit' => $this->audit,
            'scores' => $scores,
        ])->render();

        $filename = 'audits/audit-' . $this->audit->id . '-' . time() . '.pdf';

        $pdf = SnappyPdf::loadHTML($html);
        Storage::put($filename, $pdf->output());

        return $filename;
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        $this->audit->update(['status' => 'failed']);
        broadcast(new AuditUpdated($this->audit))->toOthers();
    }
}
