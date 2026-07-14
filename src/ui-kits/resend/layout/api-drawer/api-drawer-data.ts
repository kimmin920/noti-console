import type { ApiDrawerSectionData, ApiDrawerSdk } from './api-drawer-types';

const logId = '5e4d5e4d-5e4d-5e4d-5e4d-5e4d5e4d5e4d';

export const apiDrawerDefaultSdks = [
  'Node.js',
  'Ruby',
  'PHP',
  'Python',
  'Go',
  'Rust',
  'Java',
  '.NET',
  'cURL',
  'CLI',
] as const satisfies readonly ApiDrawerSdk[];

export const apiDrawerLogsSections = [
  {
    code: {
      '.NET': `using Resend;\nusing System.Linq;\n\nIResend resend = ResendClient.Create( "re_xxxxxxxxx" );\n\nvar resp = await resend.LogListAsync();\nConsole.WriteLine( "Count={0}", resp.Content.Data.Count );`,
      CLI: 'resend logs list',
      Go: `package main\n\nimport "github.com/resend/resend-go/v3"\n\nfunc main() {\n\tclient := resend.NewClient("re_xxxxxxxxx")\n\tclient.Logs.List()\n}`,
      Java: `import com.resend.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    Resend resend = new Resend("re_xxxxxxxxx");\n    resend.logs().list();\n  }\n}`,
      'Node.js': `import { Resend } from 'resend';\n\nconst resend = new Resend('re_xxxxxxxxx');\n\nconst { data, error } = await resend.logs.list();`,
      PHP: `$resend = Resend::client('re_xxxxxxxxx');\n\n$resend->logs->list();`,
      Python: `import resend\n\nresend.api_key = "re_xxxxxxxxx"\n\nresend.Logs.list()`,
      Ruby: `Resend.api_key = "re_xxxxxxxxx"\n\nlogs = Resend::Logs.list\nputs logs`,
      Rust: `use resend_rs::{Resend, Result};\n\n#[tokio::main]\nasync fn main() -> Result<()> {\n  let resend = Resend::new("re_xxxxxxxxx");\n  let _logs = resend.logs.list(Default::default()).await?;\n  Ok(())\n}`,
      cURL: `curl -X GET 'https://api.resend.com/logs' \\\n  -H 'Authorization: Bearer re_xxxxxxxxx'`,
    },
    href: 'https://resend.com/docs/api-reference/logs/list-logs',
    title: 'List logs',
  },
  {
    code: {
      '.NET': `using Resend;\n\nIResend resend = ResendClient.Create( "re_xxxxxxxxx" );\n\nvar resp = await resend.LogRetrieveAsync( new Guid( "${logId}" ) );\nConsole.WriteLine( "Endpoint={0}", resp.Content.Endpoint );`,
      CLI: `resend logs get ${logId}`,
      Go: `package main\n\nimport "github.com/resend/resend-go/v3"\n\nfunc main() {\n\tclient := resend.NewClient("re_xxxxxxxxx")\n\tclient.Logs.Get("${logId}")\n}`,
      Java: `import com.resend.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    Resend resend = new Resend("re_xxxxxxxxx");\n    resend.logs().get("${logId}");\n  }\n}`,
      'Node.js': `import { Resend } from 'resend';\n\nconst resend = new Resend('re_xxxxxxxxx');\n\nconst { data, error } = await resend.logs.get(\n  '${logId}',\n);`,
      PHP: `$resend = Resend::client('re_xxxxxxxxx');\n\n$resend->logs->get('${logId}');`,
      Python: `import resend\n\nresend.api_key = "re_xxxxxxxxx"\n\nresend.Logs.get("${logId}")`,
      Ruby: `Resend.api_key = "re_xxxxxxxxx"\n\nlog = Resend::Logs.get("${logId}")\nputs log`,
      Rust: `use resend_rs::{Resend, Result};\n\n#[tokio::main]\nasync fn main() -> Result<()> {\n  let resend = Resend::new("re_xxxxxxxxx");\n  let _log = resend.logs.get("${logId}").await?;\n  Ok(())\n}`,
      cURL: `curl -X GET 'https://api.resend.com/logs/${logId}' \\\n  -H 'Authorization: Bearer re_xxxxxxxxx'`,
    },
    href: 'https://resend.com/docs/api-reference/logs/retrieve-log',
    title: 'Retrieve Log',
  },
] as const satisfies readonly ApiDrawerSectionData[];
