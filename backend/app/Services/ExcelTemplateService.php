<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Role;
use Illuminate\Support\Facades\Log;

class ExcelTemplateService
{
    /**
     * Gather existing system roles and department assignments.
     */
    public static function getSystemRoleDepartmentData(): array
    {
        // 1. Fetch all active, non-deleted departments ordered by display_name
        $departments = Department::where('is_active', true)->orderBy('display_name')->get();

        // 2. Functional roles for user management in the system
        // Maps human-friendly role name to lowercase matching categories
        $rolesMap = [
            'Requestor' => ['requestor', 'content_requestor'],
            'Approver'  => ['approver', 'office_head', 'vice_president', 'imc_qa_checker'],
            'Admin'     => ['admin', 'it_admin', 'it_publisher'],
        ];

        // 3. Inspect Role model to include any additional or custom roles added in the system
        try {
            $dbRoles = Role::all();
            foreach ($dbRoles as $dbRole) {
                $key = strtolower(trim($dbRole->name));
                $displayName = trim($dbRole->display_name ?: $dbRole->name);
                
                $alreadyMapped = false;
                foreach ($rolesMap as $roleLabel => $aliases) {
                    if (in_array($key, $aliases, true) || strtolower($roleLabel) === strtolower($displayName)) {
                        $alreadyMapped = true;
                        break;
                    }
                }

                if (!$alreadyMapped && !empty($displayName)) {
                    $rolesMap[$displayName] = [$key];
                }
            }
        } catch (\Throwable $e) {
            Log::warning('ExcelTemplateService: Could not load roles from database: ' . $e->getMessage());
        }

        // 4. Also inspect if any active department has a role_category not yet in rolesMap
        foreach ($departments as $dept) {
            $cats = (array) ($dept->role_categories ?? []);
            foreach ($cats as $cat) {
                $catLower = strtolower(trim($cat));
                $found = false;
                foreach ($rolesMap as $roleLabel => $aliases) {
                    if (in_array($catLower, $aliases, true) || strtolower($roleLabel) === $catLower) {
                        $found = true;
                        break;
                    }
                }
                if (!$found && !empty($catLower)) {
                    $rolesMap[ucfirst($catLower)] = [$catLower];
                }
            }
        }

        // 5. Build dynamic role definitions and department mappings
        $roles = [];
        $mappings = [];

        foreach ($rolesMap as $roleName => $aliases) {
            $assignedDepts = [];

            foreach ($departments as $dept) {
                $deptCategories = array_map('strtolower', (array) ($dept->role_categories ?? []));
                if (empty($deptCategories)) {
                    $nameLower = strtolower($dept->display_name . ' ' . $dept->name);
                    if (str_contains($nameLower, 'information technology office') || str_contains($nameLower, 'it office')) {
                        $deptCategories = ['admin'];
                    } elseif (str_contains($nameLower, 'marketing') || str_contains($nameLower, 'imc') || str_contains($nameLower, 'president') || str_contains($nameLower, 'vpaa') || str_contains($nameLower, 'vice')) {
                        $deptCategories = ['approver'];
                    } else {
                        $deptCategories = ['requestor', 'approver'];
                    }
                }
                $hasAccess = false;
                foreach ($aliases as $alias) {
                    if (in_array($alias, $deptCategories, true)) {
                        $hasAccess = true;
                        break;
                    }
                }

                if ($hasAccess) {
                    $assignedDepts[] = $dept->display_name;
                }
            }

            $assignedDepts = array_values(array_unique($assignedDepts));
            sort($assignedDepts);

            $roles[] = [
                'name' => $roleName,
                'key' => strtolower($aliases[0]),
                'department_count' => count($assignedDepts),
            ];
            $mappings[$roleName] = $assignedDepts;
        }

        return [
            'roles' => $roles,
            'mappings' => $mappings,
        ];
    }

    /**
     * Generate the .xlsx template using the python generator script and system data.
     */
    public static function generateTemplate(?string $targetOutputPath = null): string
    {
        $outputPath = $targetOutputPath ?: public_path('templates/jmcfi_user_accounts_template.xlsx');
        $outputDir = dirname($outputPath);
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        $systemData = self::getSystemRoleDepartmentData();
        $tempJsonPath = tempnam(sys_get_temp_dir(), 'jmcfi_tmpl_') . '.json';
        file_put_contents($tempJsonPath, json_encode($systemData, JSON_PRETTY_PRINT));

        $scriptPath = base_path('scripts/generate_excel_template.py');
        $pythonCommand = self::resolvePythonCommand();

        $cmd = escapeshellcmd($pythonCommand) . ' ' . escapeshellarg($scriptPath) . ' ' . escapeshellarg($outputPath) . ' ' . escapeshellarg($tempJsonPath);
        exec($cmd . ' 2>&1', $outputLines, $exitCode);

        if (file_exists($tempJsonPath)) {
            @unlink($tempJsonPath);
        }

        if ($exitCode !== 0 || !file_exists($outputPath)) {
            $msg = 'Failed to generate Excel template: ' . implode("\n", $outputLines);
            Log::error($msg);
            throw new \RuntimeException($msg);
        }

        // Sync with frontend assets if accessible
        try {
            $frontendAssetPath = base_path('../frontend-rn/assets/templates/jmcfi_user_accounts_template.xlsx');
            $frontendAssetDir = dirname($frontendAssetPath);
            if (!is_dir($frontendAssetDir)) {
                @mkdir($frontendAssetDir, 0755, true);
            }
            @copy($outputPath, $frontendAssetPath);

            // Also update the base64 fallback in frontend-rn/constants/excelTemplateBase64.ts
            $frontendBase64Path = base_path('../frontend-rn/constants/excelTemplateBase64.ts');
            if (file_exists(dirname($frontendBase64Path))) {
                $base64Content = base64_encode(file_get_contents($outputPath));
                $tsCode = "// Auto-generated synchronized JMCFI Excel template base64 with dynamic role & department dropdowns\n"
                    . "export const JMCFI_EXCEL_TEMPLATE_BASE64 = \"" . $base64Content . "\";\n";
                file_put_contents($frontendBase64Path, $tsCode);
            }
        } catch (\Throwable $e) {
            Log::warning('ExcelTemplateService: Could not sync frontend template assets: ' . $e->getMessage());
        }

        return $outputPath;
    }

    /**
     * Get the latest template file path, generating if missing.
     */
    public static function getTemplatePath(): string
    {
        $path = public_path('templates/jmcfi_user_accounts_template.xlsx');
        if (!file_exists($path)) {
            return self::generateTemplate($path);
        }
        return $path;
    }

    /**
     * Detect available python executable.
     */
    private static function resolvePythonCommand(): string
    {
        $candidates = ['python', 'py -3', 'python3'];
        foreach ($candidates as $cand) {
            exec("{$cand} --version 2>&1", $out, $code);
            if ($code === 0) {
                return $cand;
            }
            $out = [];
        }
        return 'python';
    }
}
