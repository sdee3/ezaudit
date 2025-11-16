<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessAuditJob;
use App\Models\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class AuditController extends Controller
{
    /**
     * Submit a new audit request.
     */
    public function submit(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'domain' => 'required|url',
            'email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $audit = Audit::create([
            'user_id' => auth('api')->id(),
            'domain' => $request->domain,
            'email' => $request->email,
            'status' => 'pending',
        ]);

        // Dispatch the job to process the audit
        ProcessAuditJob::dispatch($audit);

        return response()->json([
            'message' => 'Audit request submitted successfully',
            'audit' => $audit,
        ], 202);
    }

    /**
     * Get all audits for the authenticated user.
     */
    public function index(Request $request)
    {
        $status = $request->query('status');

        $query = auth('api')->user()->audits()->latest();

        if ($status) {
            $query->where('status', $status);
        }

        $audits = $query->get();

        return response()->json([
            'audits' => $audits,
        ]);
    }

    /**
     * Get a specific audit.
     */
    public function show($id)
    {
        $audit = Audit::where('id', $id)
            ->where('user_id', auth('api')->id())
            ->firstOrFail();

        return response()->json([
            'audit' => $audit,
        ]);
    }

    /**
     * Download the PDF report for an audit.
     */
    public function download($id)
    {
        $audit = Audit::where('id', $id)
            ->where('user_id', auth('api')->id())
            ->firstOrFail();

        if (!$audit->pdf_path || $audit->status !== 'completed') {
            return response()->json([
                'error' => 'PDF report not available yet',
            ], 404);
        }

        if (!Storage::exists($audit->pdf_path)) {
            return response()->json([
                'error' => 'PDF file not found',
            ], 404);
        }

        return Storage::download($audit->pdf_path, "audit-{$audit->id}.pdf");
    }
}
