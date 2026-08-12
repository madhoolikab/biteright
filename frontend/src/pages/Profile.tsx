import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '../store/profileStore'
import { useAuthStore } from '../store/authStore'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'

export default function Profile() {
  const navigate = useNavigate()
  const { profile, fetchProfile, updateProfile } = useProfileStore()
  const { signOut, user } = useAuthStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  if (!profile) return null

  const startEdit = (field: string, value: string | number) => {
    setEditing(field)
    setEditValue(String(value))
  }

  const saveEdit = async () => {
    if (!editing) return
    const numericFields = ['age', 'height_cm', 'weight_kg', 'calorie_target', 'protein_target_g', 'carbs_target_g', 'fat_target_g', 'fibre_target_g', 'goal_weight_kg']
    const value = numericFields.includes(editing) ? Number(editValue) : editValue
    await updateProfile({ [editing]: value })
    setEditing(null)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const fields = [
    { key: 'name', label: 'Name', value: profile.name },
    { key: 'age', label: 'Age', value: profile.age, unit: 'years' },
    { key: 'height_cm', label: 'Height', value: profile.height_cm, unit: 'cm' },
    { key: 'weight_kg', label: 'Weight', value: profile.weight_kg, unit: 'kg' },
    { key: 'goal_weight_kg', label: 'Goal weight', value: profile.goal_weight_kg ?? '-', unit: 'kg' },
  ]

  const targets = [
    { key: 'calorie_target', label: 'Calories', value: profile.calorie_target, unit: 'kcal' },
    { key: 'protein_target_g', label: 'Protein', value: profile.protein_target_g, unit: 'g' },
    { key: 'carbs_target_g', label: 'Carbs', value: profile.carbs_target_g, unit: 'g' },
    { key: 'fat_target_g', label: 'Fat', value: profile.fat_target_g, unit: 'g' },
    { key: 'fibre_target_g', label: 'Fibre', value: profile.fibre_target_g, unit: 'g' },
  ]

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl text-foreground">Profile</h1>

      {/* Personal details */}
      <Card>
        <h3 className="font-semibold text-sm mb-3">Personal Details</h3>
        <div className="divide-y divide-border">
          {fields.map(({ key, label, value, unit }) => (
            <div key={key}>
              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground text-sm">{label}</span>
                {editing === key ? (
                  <div className="flex items-center gap-2">
                    <input
                      type={typeof value === 'number' ? 'number' : 'text'}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 px-2 py-1 border border-primary rounded text-right text-sm focus:outline-none"
                      autoFocus
                    />
                    {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
                    <button onClick={saveEdit} className="text-primary text-sm font-medium">Save</button>
                  </div>
                ) : (
                  <button onClick={() => startEdit(key, value)} className="text-sm font-medium">
                    {value}{unit ? ` ${unit}` : ''}
                  </button>
                )}
              </div>
              {key === 'name' && user?.email && (
                <div className="flex items-center justify-between py-3 border-t border-border">
                  <span className="text-muted-foreground text-sm">Email</span>
                  <span className="text-sm font-medium text-muted-foreground">{user.email}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Targets */}
      <Card>
        <h3 className="font-semibold text-sm mb-3">Daily Targets</h3>
        <div className="divide-y divide-border">
          {targets.map(({ key, label, value, unit }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <span className="text-muted-foreground text-sm">{label}</span>
              {editing === key ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-20 px-2 py-1 border border-primary rounded text-right text-sm focus:outline-none"
                    autoFocus
                  />
                  <span className="text-xs text-muted-foreground">{unit}</span>
                  <button onClick={saveEdit} className="text-primary text-sm font-medium">Save</button>
                </div>
              ) : (
                <button onClick={() => startEdit(key, value)} className="text-sm font-medium">
                  {value} {unit}
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Preferences */}
      <Card>
        <h3 className="font-semibold text-sm mb-3">Preferences</h3>
        <div className="divide-y divide-border">
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground text-sm">Goal</span>
            <span className="text-sm font-medium capitalize">{profile.goal} weight</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground text-sm">Diet</span>
            <span className="text-sm font-medium capitalize">{profile.dietary_preference.replace('_', '-')}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground text-sm">Cuisine</span>
            <span className="text-sm font-medium capitalize">{profile.primary_cuisine.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground text-sm">Activity</span>
            <span className="text-sm font-medium capitalize">{profile.activity_level.replace('_', ' ')}</span>
          </div>
        </div>
      </Card>

      {/* Sign out */}
      <Button variant="ghost" onClick={handleSignOut} className="w-full text-red-500 hover:bg-red-50">
        Sign Out
      </Button>
    </div>
  )
}
