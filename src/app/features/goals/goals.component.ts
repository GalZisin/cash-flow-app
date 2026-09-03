import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FinancialGoal, GoalMilestone, GoalType, GoalScheduleType } from '../../models/goal.model';
import { GoalsService } from '../../services/goals.service';

@Component({
    selector: 'app-goals', standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslateModule],
    templateUrl: './goals.component.html', styleUrl: './goals.component.scss'
})
export class GoalsComponent implements OnInit {
    readonly goalTypes = Object.values(GoalType);
    readonly isLoading = signal(true);
    readonly isSaving = signal(false);
    readonly error = signal('');
    readonly form: ReturnType<FormBuilder['group']>;
    readonly scheduleTypes: GoalScheduleType[] = ['single', 'loan', 'milestone'];

    constructor(public readonly goalsService: GoalsService, private fb: FormBuilder) {
        this.form = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            type: [GoalType.SAVINGS, Validators.required],
            targetAmount: [null as number | null, [Validators.required, Validators.min(1)]],
            targetDate: [''], description: [''], isFixed: [false], scheduleType: ['single'],
            loanAmount: [null as number | null], downPayment: [null as number | null],
            monthlyPayment: [null as number | null], loanMonths: [null as number | null], interestRate: [0]
        });
    }
    ngOnInit(): void { this.refresh(); }
    get goals(): FinancialGoal[] { return [...this.goalsService.goals()].sort((a, b) => a.targetDate.localeCompare(b.targetDate)); }

    refresh(): void {
        this.isLoading.set(true); this.error.set('');
        this.goalsService.load().subscribe({
            next: () => this.goalsService.loadOverview().subscribe(),
            error: () => this.error.set('GOALS.LOAD_ERROR'),
            complete: () => this.isLoading.set(false)
        });
    }

    addGoal(): void {
        const scheduleType = this.form.value.scheduleType || 'single';
        if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('GOALS.FORM_ERROR'); return; }
        if (scheduleType === 'milestone') {
            if (!this.milestones.length) { this.error.set('GOALS.MILESTONE_REQUIRED'); return; }
            if (this.milestones.some(milestone => !milestone.date || (Number(milestone.percentage) <= 0 && Number(milestone.amount) <= 0))) { this.error.set('GOALS.MILESTONE_FIELDS_ERROR'); return; }
            const targetAmount = Number(this.form.value.targetAmount) || 0;
            const enteredAmounts = this.milestones.reduce((sum, milestone) => sum + (Number(milestone.amount) || 0), 0);
            const enteredPercentages = this.milestones.reduce((sum, milestone) => sum + (Number(milestone.percentage) || 0), 0);
            const usesAmounts = this.milestones.some(milestone => Number(milestone.amount) > 0);
            if (usesAmounts ? Math.abs(enteredAmounts - targetAmount) > 0.01 : Math.abs(enteredPercentages - 100) > 0.01) { this.error.set(usesAmounts ? 'GOALS.MILESTONE_AMOUNT_TOTAL_ERROR' : 'GOALS.MILESTONE_TOTAL_ERROR'); return; }
        } else if (scheduleType === 'single' && !this.form.value.targetDate) {
            this.error.set('GOALS.SINGLE_DATE_REQUIRED'); return;
        }
        this.isSaving.set(true); this.error.set('');
        const targetDate = scheduleType === 'milestone'
            ? this.milestones.map(milestone => milestone.date).sort().at(-1) || ''
            : this.form.value.targetDate || '';
        this.goalsService.create({
            name: this.form.value.name || '', type: this.form.value.type || GoalType.SAVINGS,
            targetAmount: Number(this.form.value.targetAmount), targetDate,
            description: this.form.value.description || '', priority: 999, completed: false,
            isFixed: !!this.form.value.isFixed,
            schedule: this.buildSchedule(),
            ...(this.form.value.scheduleType === 'loan' ? {
                loanDetails: {
                    loanAmount: Number(this.form.value.loanAmount), downPayment: Number(this.form.value.downPayment),
                    monthlyPayment: Number(this.form.value.monthlyPayment), months: Number(this.form.value.loanMonths),
                    interestRate: Number(this.form.value.interestRate) || 0
                }
            } : {}),
            ...(this.form.value.scheduleType === 'milestone' ? { milestones: this.milestonesFromForm() } : {})
        }).subscribe({
            next: () => { this.form.reset({ type: GoalType.SAVINGS, name: '', targetAmount: null, targetDate: '', description: '', isFixed: false, scheduleType: 'single' }); this.milestones = []; this.goalsService.loadOverview().subscribe(); },
            error: () => this.error.set('GOALS.SAVE_ERROR'), complete: () => this.isSaving.set(false)
        });
    }

    removeGoal(goal: FinancialGoal): void {
        if (!confirm(`${goal.name}?`)) return;
        this.goalsService.remove(goal.id).subscribe({ next: () => this.goalsService.loadOverview().subscribe(), error: () => this.error.set('GOALS.DELETE_ERROR') });
    }

    analyzeGoal(goal: FinancialGoal): void {
        this.goalsService.analyze(goal.id).subscribe({ error: () => this.error.set('GOALS.ANALYZE_ERROR') });
    }

    statusClass(goal: FinancialGoal): string { return (goal.analysis?.status || 'PENDING').toLowerCase(); }

    milestones: GoalMilestone[] = [];
    addMilestone(): void { this.milestones = [...this.milestones, { id: `${Date.now()}-${this.milestones.length}`, description: '', percentage: 0, amount: 0, date: '' }]; }
    removeMilestone(index: number): void { this.milestones = this.milestones.filter((_, current) => current !== index); }
    milestonesFromForm(): GoalMilestone[] {
        const targetAmount = Number(this.form.value.targetAmount) || 0;
        const usesAmounts = this.milestones.some(milestone => Number(milestone.amount) > 0);
        return this.milestones.map(milestone => ({ ...milestone, percentage: usesAmounts ? (Number(milestone.amount) || 0) / targetAmount * 100 : Number(milestone.percentage) || 0, amount: usesAmounts ? Number(milestone.amount) || 0 : targetAmount * (Number(milestone.percentage) || 0) / 100 }));
    }

    buildSchedule(): any {
        const type = this.form.value.scheduleType || 'single';
        if (type === 'loan') {
            return { type, loan: { loanAmount: Number(this.form.value.loanAmount) || 0, downPayment: Number(this.form.value.downPayment) || 0, monthlyPayment: Number(this.form.value.monthlyPayment) || 0, months: Number(this.form.value.loanMonths) || 0, interestRate: Number(this.form.value.interestRate) || 0 } };
        }
        if (type === 'milestone') return { type, milestones: this.milestonesFromForm() };
        return { type, amount: Number(this.form.value.targetAmount) || 0, date: this.form.value.targetDate || '' };
    }
}
