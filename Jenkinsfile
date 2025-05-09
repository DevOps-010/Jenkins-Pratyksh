pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'document-converter-api'
        DOCKER_TAG = "${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
                sh 'npm install -g eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin'
                sh 'npm install --save-dev jest @types/jest'
            }
        }

        stage('Lint') {
            steps {
                sh 'npx eslint . --ext .ts'
            }
        }

        stage('Test') {
            steps {
                sh 'npx jest --passWithNoTests'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Docker Build') {
            steps {
                sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh "echo 'Deploying ${DOCKER_IMAGE}:${DOCKER_TAG}'"
                // Add your deployment commands here
                // Example:
                // sh "docker push ${DOCKER_IMAGE}:${DOCKER_TAG}"
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
} 