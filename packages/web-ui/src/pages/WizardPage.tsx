import { useParams } from 'react-router-dom'
import { useWizardState, useWizardSteps } from '../hooks/useWizardState'
import { skills } from '../data'
import WizardShell from '../components/wizard/WizardShell'
import StepSkillSelect from '../components/wizard/StepSkillSelect'
import StepStyleSelect from '../components/wizard/StepStyleSelect'
import StepContentInput from '../components/wizard/StepContentInput'
import StepReview from '../components/wizard/StepReview'
import StepExecute from '../components/wizard/StepExecute'
import BackToStudioButton from '../components/ui/BackToStudioButton'

export default function WizardPage() {
  const { skill: preselectSkill } = useParams<{ skill: string }>()
  const steps = useWizardSteps()
  const { state, skill, setStep, setSkill, setSelection, setAllSelections, setContent, setParam, canNext, canPrev } = useWizardState(preselectSkill)

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <BackToStudioButton className="absolute right-4 top-10 sm:right-6 lg:right-8" />
      <WizardShell
        steps={steps}
        currentStep={state.step}
        onStepClick={setStep}
        onNext={() => setStep(state.step + 1)}
        onPrev={() => setStep(state.step - 1)}
        canNext={canNext}
        canPrev={canPrev}
        nextLabel={state.step === steps.length ? 'Finish' : 'Next'}
      >
        {/* Step 1: Skill Selection */}
        {state.step === 1 && (
          <StepSkillSelect
            skills={skills}
            selectedId={state.skillId}
            onSelect={(id) => setSkill(id)}
          />
        )}

        {/* Step 2: Content + Auto-recommend trigger */}
        {state.step === 2 && skill && (
          <StepContentInput
            skill={skill}
            content={state.content}
            language={state.language}
            aspectRatio={state.aspectRatio}
            imageCount={state.imageCount}
            onContentChange={setContent}
            onParamChange={setParam}
          />
        )}

        {/* Step 3: Smart Confirm / Style Selection */}
        {state.step === 3 && skill && (
          <StepStyleSelect
            skill={skill}
            content={state.content}
            selections={state.selections}
            onSelect={setSelection}
            onSelectAll={setAllSelections}
            onAcceptRecommendation={() => setStep(4)}
          />
        )}

        {/* Step 4: Review */}
        {state.step === 4 && skill && (
          <StepReview
            skill={skill}
            state={state}
            onEditStep={setStep}
          />
        )}

        {/* Step 5: Generate / Export */}
        {state.step === 5 && skill && (
          <StepExecute
            skill={skill}
            state={state}
          />
        )}
      </WizardShell>
    </div>
  )
}
