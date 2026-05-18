import { getUserProjects } from '@/server/actions/project'
import { ProjectList } from './project-list'

export default async function ProjectsPage() {
  const projects = await getUserProjects()

  const projectItems = projects.map((project) => ({
    id: project.id,
    name: project.name,
    startDate: project.startDate,
    endDate: project.endDate,
  }))

  return <ProjectList projects={projectItems} />
}
