import { useRecipes } from '../api'

export default function Recipes() {
  const { data: recipes, isLoading, error } = useRecipes()

  if (isLoading) return <p className="loading">Loading…</p>
  if (error) return <p className="error">Failed to load recipes.</p>
  if (!recipes?.length) return <p className="empty">No recipes found.</p>

  return (
    <div className="recipe-grid">
      {recipes.map(recipe => (
        <div key={recipe.id} className="recipe-card">
          {recipe.coverPhotoUrl ? (
            <img
              className="recipe-cover"
              src={recipe.coverPhotoUrl}
              alt={recipe.name}
              loading="lazy"
            />
          ) : (
            <div className="recipe-cover-placeholder">🍽</div>
          )}
          <div className="recipe-body">
            <div className="recipe-name">{recipe.name}</div>
            <div className="recipe-tags">
              {recipe.type && <span className="recipe-tag">{recipe.type}</span>}
              {recipe.day && <span className="recipe-tag">{recipe.day}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
