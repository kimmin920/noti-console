import Playground from '@/playground/Playground.jsx';

export default async function PlaygroundComponentRoute({ params }) {
  const { sectionId, componentId } = await params;

  return <Playground initialRoute={{ mode: 'component', sectionId, componentId }} />;
}
